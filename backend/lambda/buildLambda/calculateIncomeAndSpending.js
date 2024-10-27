"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.calculateIncomeAndSpending = void 0;
const client_dynamodb_1 = require("@aws-sdk/client-dynamodb");
const Entities_1 = require("./queries/Entities");
const Encryption_1 = require("./queries/Encryption");
const Item_1 = require("./mappers/Item");
const Transactions_1 = require("./mappers/Transactions");
const Summaries_1 = require("./queries/Summaries");
const client = new client_dynamodb_1.DynamoDBClient({ region: 'ca-central-1' });
function aggregateSpendingByCategory(transactions) {
    const MS_IN_A_DAY = 1000 * 60 * 60 * 24;
    // Initialize accumulators
    const dailySpendingMap = {};
    const weeklySpending = {};
    const monthlySpending = {};
    // Step 1: Sum amounts per category by day
    for (const transaction of transactions) {
        if (transaction.amount && transaction.date) {
            const amount = parseFloat(transaction.amount);
            const date = new Date(transaction.date);
            const dateKey = date.toISOString().split('T')[0]; // Format date as YYYY-MM-DD
            // Only consider transactions that are spending, not income or transfers
            const category = transaction.personal_finance_category?.primary;
            if (category) {
                // Initialize daily spending map for the date if not present
                if (!dailySpendingMap[dateKey]) {
                    dailySpendingMap[dateKey] = {};
                }
                // Aggregate amounts for each category in daily, weekly, and monthly maps
                dailySpendingMap[dateKey][category] = (dailySpendingMap[dateKey][category] || 0) + Math.abs(amount);
                weeklySpending[category] = (weeklySpending[category] || 0) + Math.abs(amount);
                monthlySpending[category] = (monthlySpending[category] || 0) + Math.abs(amount);
            }
        }
    }
    // Convert daily spending map to an array of DailySpendingSummary
    const dailySpendingSummaries = Object.entries(dailySpendingMap).map(([date, spending]) => ({
        date,
        spending,
    }));
    // Step 2: Calculate date range for averages
    const transactionDates = Object.keys(dailySpendingMap).map((date) => new Date(date));
    if (transactionDates.length === 0) {
        throw new Error('No valid transactions found to aggregate.');
    }
    const minDate = new Date(Math.min(...transactionDates.map((date) => date.getTime())));
    const maxDate = new Date(Math.max(...transactionDates.map((date) => date.getTime())));
    const durationInDays = (maxDate.getTime() - minDate.getTime()) / MS_IN_A_DAY;
    // Step 3: Calculate weekly and monthly averages
    for (const category of Object.keys(weeklySpending)) {
        if (weeklySpending[category])
            weeklySpending[category] /= durationInDays / 7;
        if (monthlySpending[category])
            monthlySpending[category] /= durationInDays / 30;
    }
    return {
        daily_spending: dailySpendingSummaries,
        weekly_spending: weeklySpending,
        monthly_spending: monthlySpending,
    };
}
function groupTransactionsByMonth(transactions) {
    const monthlyAggregates = {};
    const transactionsByMonth = transactions.reduce((acc, transaction) => {
        if (transaction.date) {
            const date = new Date(transaction.date);
            const monthYear = `${date.getFullYear()}-${date.getMonth() + 1}`;
            if (!acc[monthYear]) {
                acc[monthYear] = [];
            }
            acc[monthYear].push(transaction);
        }
        return acc;
    }, {});
    for (const [monthYear, monthTransactions] of Object.entries(transactionsByMonth)) {
        monthlyAggregates[monthYear] = aggregateSpendingByCategory(monthTransactions);
    }
    return monthlyAggregates;
}
function getEarliestFirstOfMonthWithin90Days(createdAt) {
    const date90DaysAgo = new Date(createdAt);
    date90DaysAgo.setDate(date90DaysAgo.getDate() - 90);
    // Get the first day of the current month of `createdAt`
    const firstOfCurrentMonth = new Date(createdAt.getFullYear(), createdAt.getMonth(), 1);
    // Check if the first day of the current month is within 90 days
    if (firstOfCurrentMonth >= date90DaysAgo) {
        return firstOfCurrentMonth;
    }
    // If not, return the first day of the earliest month within the 90-day range
    return new Date(date90DaysAgo.getFullYear(), date90DaysAgo.getMonth(), 1);
}
const calculateIncomeAndSpending = async () => {
    // TODO: Add logic to handle last calculated complete month and start from then
    const items = (await (0, Encryption_1.decryptItemsInBatches)((await client.send((0, Entities_1.GetItems)()))?.Items ?? [])).map(Item_1.mapDdbResponseToItem);
    /** TODO: Just add created at to the item? */
    const encryptedUserItemRecord = await Promise.all(items.map(async (el) => await client.send((0, Entities_1.GetUser)(el.sk || ''))));
    const decryptedUserItemRecord = (await (0, Encryption_1.decryptItemsInBatches)(encryptedUserItemRecord)).map(Item_1.mapDdbResponseToItem);
    /** Go through users and aggregate transactions */
    await processUsersInBatches(decryptedUserItemRecord);
};
exports.calculateIncomeAndSpending = calculateIncomeAndSpending;
function chunkArray(array, chunkSize) {
    const chunks = [];
    for (let i = 0; i < array.length; i += chunkSize) {
        chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
}
async function processUsersInBatches(decryptedUserItemRecord) {
    const userBatches = chunkArray(decryptedUserItemRecord, 100);
    const now = new Date(); // Get the current date and time
    for (const batch of userBatches) {
        await Promise.all(batch.map(async (item) => {
            const startDay = getEarliestFirstOfMonthWithin90Days(new Date(item?.created_at ?? 0));
            const encryptedTransactions = await client.send((0, Entities_1.GetEntities)({
                pk: item.pk ?? '',
                dateRange: {
                    startDay: {
                        day: startDay.getDate() + 1,
                        month: startDay.getMonth() + 1,
                        year: startDay.getFullYear(),
                    },
                    endDay: {
                        day: now.getDate() + 1,
                        month: now.getMonth() + 1,
                        year: now.getFullYear(),
                    },
                    hasNoTimeConstraint: false,
                },
                username: '',
                id: '',
                entityName: 'TRANSACTION',
            }));
            const decryptedTransactions = (await (0, Encryption_1.decryptItemsInBatches)(encryptedTransactions.Items ?? [])).map(Transactions_1.mapDynamoDBToTransaction);
            const aggregates = groupTransactionsByMonth(decryptedTransactions);
            await (0, Summaries_1.uploadSpendingSummaries)(item.pk ?? '', Object.entries(aggregates).flatMap((el) => el[1].daily_spending), aggregates);
        }));
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2FsY3VsYXRlSW5jb21lQW5kU3BlbmRpbmcuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi9zcmMvY2FsY3VsYXRlSW5jb21lQW5kU3BlbmRpbmcudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7O0FBQUEsOERBQXlEO0FBQ3pELGlEQUFtRTtBQUNuRSxxREFBNEQ7QUFDNUQseUNBQXFEO0FBRXJELHlEQUFpRTtBQUNqRSxtREFBNkQ7QUFFN0QsTUFBTSxNQUFNLEdBQUcsSUFBSSxnQ0FBYyxDQUFDLEVBQUUsTUFBTSxFQUFFLGNBQWMsRUFBRSxDQUFDLENBQUE7QUFpQjdELFNBQVMsMkJBQTJCLENBQUMsWUFBMkI7SUFDNUQsTUFBTSxXQUFXLEdBQUcsSUFBSSxHQUFHLEVBQUUsR0FBRyxFQUFFLEdBQUcsRUFBRSxDQUFBO0lBRXZDLDBCQUEwQjtJQUMxQixNQUFNLGdCQUFnQixHQUFnRixFQUFFLENBQUE7SUFDeEcsTUFBTSxjQUFjLEdBQUcsRUFBNkQsQ0FBQTtJQUNwRixNQUFNLGVBQWUsR0FBRyxFQUE2RCxDQUFBO0lBRXJGLDBDQUEwQztJQUMxQyxLQUFLLE1BQU0sV0FBVyxJQUFJLFlBQVksRUFBRSxDQUFDO1FBQ3JDLElBQUksV0FBVyxDQUFDLE1BQU0sSUFBSSxXQUFXLENBQUMsSUFBSSxFQUFFLENBQUM7WUFDekMsTUFBTSxNQUFNLEdBQUcsVUFBVSxDQUFDLFdBQVcsQ0FBQyxNQUFNLENBQUMsQ0FBQTtZQUM3QyxNQUFNLElBQUksR0FBRyxJQUFJLElBQUksQ0FBQyxXQUFXLENBQUMsSUFBSSxDQUFDLENBQUE7WUFDdkMsTUFBTSxPQUFPLEdBQUcsSUFBSSxDQUFDLFdBQVcsRUFBRSxDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQSxDQUFDLDRCQUE0QjtZQUU3RSx3RUFBd0U7WUFDeEUsTUFBTSxRQUFRLEdBQUcsV0FBVyxDQUFDLHlCQUF5QixFQUFFLE9BQU8sQ0FBQTtZQUMvRCxJQUFJLFFBQVEsRUFBRSxDQUFDO2dCQUNYLDREQUE0RDtnQkFDNUQsSUFBSSxDQUFDLGdCQUFnQixDQUFDLE9BQU8sQ0FBQyxFQUFFLENBQUM7b0JBQzdCLGdCQUFnQixDQUFDLE9BQU8sQ0FBQyxHQUFHLEVBQUUsQ0FBQTtnQkFDbEMsQ0FBQztnQkFFRCx5RUFBeUU7Z0JBQ3pFLGdCQUFnQixDQUFDLE9BQU8sQ0FBQyxDQUFDLFFBQVEsQ0FBQyxHQUFHLENBQUMsZ0JBQWdCLENBQUMsT0FBTyxDQUFDLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQyxDQUFDLEdBQUcsSUFBSSxDQUFDLEdBQUcsQ0FBQyxNQUFNLENBQUMsQ0FBQTtnQkFDbkcsY0FBYyxDQUFDLFFBQVEsQ0FBQyxHQUFHLENBQUMsY0FBYyxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsQ0FBQyxHQUFHLElBQUksQ0FBQyxHQUFHLENBQUMsTUFBTSxDQUFDLENBQUE7Z0JBQzdFLGVBQWUsQ0FBQyxRQUFRLENBQUMsR0FBRyxDQUFDLGVBQWUsQ0FBQyxRQUFRLENBQUMsSUFBSSxDQUFDLENBQUMsR0FBRyxJQUFJLENBQUMsR0FBRyxDQUFDLE1BQU0sQ0FBQyxDQUFBO1lBQ25GLENBQUM7UUFDTCxDQUFDO0lBQ0wsQ0FBQztJQUVELGlFQUFpRTtJQUNqRSxNQUFNLHNCQUFzQixHQUEyQixNQUFNLENBQUMsT0FBTyxDQUFDLGdCQUFnQixDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxJQUFJLEVBQUUsUUFBUSxDQUFDLEVBQUUsRUFBRSxDQUFDLENBQUM7UUFDL0csSUFBSTtRQUNKLFFBQVE7S0FDWCxDQUFDLENBQUMsQ0FBQTtJQUVILDRDQUE0QztJQUM1QyxNQUFNLGdCQUFnQixHQUFHLE1BQU0sQ0FBQyxJQUFJLENBQUMsZ0JBQWdCLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxJQUFJLEVBQUUsRUFBRSxDQUFDLElBQUksSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUE7SUFDcEYsSUFBSSxnQkFBZ0IsQ0FBQyxNQUFNLEtBQUssQ0FBQyxFQUFFLENBQUM7UUFDaEMsTUFBTSxJQUFJLEtBQUssQ0FBQywyQ0FBMkMsQ0FBQyxDQUFBO0lBQ2hFLENBQUM7SUFFRCxNQUFNLE9BQU8sR0FBRyxJQUFJLElBQUksQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLEdBQUcsZ0JBQWdCLENBQUMsR0FBRyxDQUFDLENBQUMsSUFBSSxFQUFFLEVBQUUsQ0FBQyxJQUFJLENBQUMsT0FBTyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUE7SUFDckYsTUFBTSxPQUFPLEdBQUcsSUFBSSxJQUFJLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxHQUFHLGdCQUFnQixDQUFDLEdBQUcsQ0FBQyxDQUFDLElBQUksRUFBRSxFQUFFLENBQUMsSUFBSSxDQUFDLE9BQU8sRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFBO0lBQ3JGLE1BQU0sY0FBYyxHQUFHLENBQUMsT0FBTyxDQUFDLE9BQU8sRUFBRSxHQUFHLE9BQU8sQ0FBQyxPQUFPLEVBQUUsQ0FBQyxHQUFHLFdBQVcsQ0FBQTtJQUU1RSxnREFBZ0Q7SUFDaEQsS0FBSyxNQUFNLFFBQVEsSUFBSSxNQUFNLENBQUMsSUFBSSxDQUFDLGNBQWMsQ0FBbUMsRUFBRSxDQUFDO1FBQ25GLElBQUksY0FBYyxDQUFDLFFBQVEsQ0FBQztZQUFFLGNBQWMsQ0FBQyxRQUFRLENBQUUsSUFBSSxjQUFjLEdBQUcsQ0FBQyxDQUFBO1FBQzdFLElBQUksZUFBZSxDQUFDLFFBQVEsQ0FBQztZQUFFLGVBQWUsQ0FBQyxRQUFRLENBQUUsSUFBSSxjQUFjLEdBQUcsRUFBRSxDQUFBO0lBQ3BGLENBQUM7SUFFRCxPQUFPO1FBQ0gsY0FBYyxFQUFFLHNCQUFzQjtRQUN0QyxlQUFlLEVBQUUsY0FBYztRQUMvQixnQkFBZ0IsRUFBRSxlQUFlO0tBQ3BDLENBQUE7QUFDTCxDQUFDO0FBRUQsU0FBUyx3QkFBd0IsQ0FBQyxZQUEyQjtJQUN6RCxNQUFNLGlCQUFpQixHQUE4QixFQUFFLENBQUE7SUFFdkQsTUFBTSxtQkFBbUIsR0FBMkMsWUFBWSxDQUFDLE1BQU0sQ0FBQyxDQUFDLEdBQUcsRUFBRSxXQUFXLEVBQUUsRUFBRTtRQUN6RyxJQUFJLFdBQVcsQ0FBQyxJQUFJLEVBQUUsQ0FBQztZQUNuQixNQUFNLElBQUksR0FBRyxJQUFJLElBQUksQ0FBQyxXQUFXLENBQUMsSUFBSSxDQUFDLENBQUE7WUFDdkMsTUFBTSxTQUFTLEdBQUcsR0FBRyxJQUFJLENBQUMsV0FBVyxFQUFFLElBQUksSUFBSSxDQUFDLFFBQVEsRUFBRSxHQUFHLENBQUMsRUFBRSxDQUFBO1lBRWhFLElBQUksQ0FBQyxHQUFHLENBQUMsU0FBUyxDQUFDLEVBQUUsQ0FBQztnQkFDbEIsR0FBRyxDQUFDLFNBQVMsQ0FBQyxHQUFHLEVBQUUsQ0FBQTtZQUN2QixDQUFDO1lBRUQsR0FBRyxDQUFDLFNBQVMsQ0FBQyxDQUFDLElBQUksQ0FBQyxXQUFXLENBQUMsQ0FBQTtRQUNwQyxDQUFDO1FBQ0QsT0FBTyxHQUFHLENBQUE7SUFDZCxDQUFDLEVBQUUsRUFBNEMsQ0FBQyxDQUFBO0lBRWhELEtBQUssTUFBTSxDQUFDLFNBQVMsRUFBRSxpQkFBaUIsQ0FBQyxJQUFJLE1BQU0sQ0FBQyxPQUFPLENBQUMsbUJBQW1CLENBQUMsRUFBRSxDQUFDO1FBQy9FLGlCQUFpQixDQUFDLFNBQVMsQ0FBQyxHQUFHLDJCQUEyQixDQUFDLGlCQUFpQixDQUFDLENBQUE7SUFDakYsQ0FBQztJQUVELE9BQU8saUJBQWlCLENBQUE7QUFDNUIsQ0FBQztBQUNELFNBQVMsbUNBQW1DLENBQUMsU0FBZTtJQUN4RCxNQUFNLGFBQWEsR0FBRyxJQUFJLElBQUksQ0FBQyxTQUFTLENBQUMsQ0FBQTtJQUN6QyxhQUFhLENBQUMsT0FBTyxDQUFDLGFBQWEsQ0FBQyxPQUFPLEVBQUUsR0FBRyxFQUFFLENBQUMsQ0FBQTtJQUVuRCx3REFBd0Q7SUFDeEQsTUFBTSxtQkFBbUIsR0FBRyxJQUFJLElBQUksQ0FBQyxTQUFTLENBQUMsV0FBVyxFQUFFLEVBQUUsU0FBUyxDQUFDLFFBQVEsRUFBRSxFQUFFLENBQUMsQ0FBQyxDQUFBO0lBRXRGLGdFQUFnRTtJQUNoRSxJQUFJLG1CQUFtQixJQUFJLGFBQWEsRUFBRSxDQUFDO1FBQ3ZDLE9BQU8sbUJBQW1CLENBQUE7SUFDOUIsQ0FBQztJQUVELDZFQUE2RTtJQUM3RSxPQUFPLElBQUksSUFBSSxDQUFDLGFBQWEsQ0FBQyxXQUFXLEVBQUUsRUFBRSxhQUFhLENBQUMsUUFBUSxFQUFFLEVBQUUsQ0FBQyxDQUFDLENBQUE7QUFDN0UsQ0FBQztBQUVNLE1BQU0sMEJBQTBCLEdBQUcsS0FBSyxJQUFJLEVBQUU7SUFDakQsK0VBQStFO0lBQy9FLE1BQU0sS0FBSyxHQUFHLENBQUMsTUFBTSxJQUFBLGtDQUFxQixFQUFDLENBQUMsTUFBTSxNQUFNLENBQUMsSUFBSSxDQUFDLElBQUEsbUJBQVEsR0FBRSxDQUFDLENBQUMsRUFBRSxLQUFLLElBQUksRUFBRSxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsMkJBQW9CLENBQUMsQ0FBQTtJQUNuSCw2Q0FBNkM7SUFDN0MsTUFBTSx1QkFBdUIsR0FBRyxNQUFNLE9BQU8sQ0FBQyxHQUFHLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxLQUFLLEVBQUUsRUFBRSxFQUFFLEVBQUUsQ0FBQyxNQUFNLE1BQU0sQ0FBQyxJQUFJLENBQUMsSUFBQSxrQkFBTyxFQUFDLEVBQUUsQ0FBQyxFQUFFLElBQUksRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUE7SUFDbkgsTUFBTSx1QkFBdUIsR0FBRyxDQUFDLE1BQU0sSUFBQSxrQ0FBcUIsRUFBQyx1QkFBdUIsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLDJCQUFvQixDQUFDLENBQUE7SUFDaEgsa0RBQWtEO0lBQ2xELE1BQU0scUJBQXFCLENBQUMsdUJBQXVCLENBQUMsQ0FBQTtBQUN4RCxDQUFDLENBQUE7QUFSWSxRQUFBLDBCQUEwQiw4QkFRdEM7QUFFRCxTQUFTLFVBQVUsQ0FBSSxLQUFVLEVBQUUsU0FBaUI7SUFDaEQsTUFBTSxNQUFNLEdBQVUsRUFBRSxDQUFBO0lBQ3hCLEtBQUssSUFBSSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsR0FBRyxLQUFLLENBQUMsTUFBTSxFQUFFLENBQUMsSUFBSSxTQUFTLEVBQUUsQ0FBQztRQUMvQyxNQUFNLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxLQUFLLENBQUMsQ0FBQyxFQUFFLENBQUMsR0FBRyxTQUFTLENBQUMsQ0FBQyxDQUFBO0lBQzlDLENBQUM7SUFDRCxPQUFPLE1BQU0sQ0FBQTtBQUNqQixDQUFDO0FBRUQsS0FBSyxVQUFVLHFCQUFxQixDQUFDLHVCQUErQjtJQUNoRSxNQUFNLFdBQVcsR0FBRyxVQUFVLENBQUMsdUJBQXVCLEVBQUUsR0FBRyxDQUFDLENBQUE7SUFDNUQsTUFBTSxHQUFHLEdBQUcsSUFBSSxJQUFJLEVBQUUsQ0FBQSxDQUFDLGdDQUFnQztJQUV2RCxLQUFLLE1BQU0sS0FBSyxJQUFJLFdBQVcsRUFBRSxDQUFDO1FBQzlCLE1BQU0sT0FBTyxDQUFDLEdBQUcsQ0FDYixLQUFLLENBQUMsR0FBRyxDQUFDLEtBQUssRUFBRSxJQUFJLEVBQUUsRUFBRTtZQUNyQixNQUFNLFFBQVEsR0FBRyxtQ0FBbUMsQ0FBQyxJQUFJLElBQUksQ0FBQyxJQUFJLEVBQUUsVUFBVSxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUE7WUFFckYsTUFBTSxxQkFBcUIsR0FBRyxNQUFNLE1BQU0sQ0FBQyxJQUFJLENBQzNDLElBQUEsc0JBQVcsRUFBQztnQkFDUixFQUFFLEVBQUUsSUFBSSxDQUFDLEVBQUUsSUFBSSxFQUFFO2dCQUNqQixTQUFTLEVBQUU7b0JBQ1AsUUFBUSxFQUFFO3dCQUNOLEdBQUcsRUFBRSxRQUFRLENBQUMsT0FBTyxFQUFFLEdBQUcsQ0FBQzt3QkFDM0IsS0FBSyxFQUFFLFFBQVEsQ0FBQyxRQUFRLEVBQUUsR0FBRyxDQUFDO3dCQUM5QixJQUFJLEVBQUUsUUFBUSxDQUFDLFdBQVcsRUFBRTtxQkFDL0I7b0JBQ0QsTUFBTSxFQUFFO3dCQUNKLEdBQUcsRUFBRSxHQUFHLENBQUMsT0FBTyxFQUFFLEdBQUcsQ0FBQzt3QkFDdEIsS0FBSyxFQUFFLEdBQUcsQ0FBQyxRQUFRLEVBQUUsR0FBRyxDQUFDO3dCQUN6QixJQUFJLEVBQUUsR0FBRyxDQUFDLFdBQVcsRUFBRTtxQkFDMUI7b0JBQ0QsbUJBQW1CLEVBQUUsS0FBSztpQkFDN0I7Z0JBQ0QsUUFBUSxFQUFFLEVBQUU7Z0JBQ1osRUFBRSxFQUFFLEVBQUU7Z0JBQ04sVUFBVSxFQUFFLGFBQWE7YUFDNUIsQ0FBQyxDQUNMLENBQUE7WUFFRCxNQUFNLHFCQUFxQixHQUFHLENBQUMsTUFBTSxJQUFBLGtDQUFxQixFQUFDLHFCQUFxQixDQUFDLEtBQUssSUFBSSxFQUFFLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FDOUYsdUNBQXdCLENBQzNCLENBQUE7WUFFRCxNQUFNLFVBQVUsR0FBRyx3QkFBd0IsQ0FBQyxxQkFBcUIsQ0FBQyxDQUFBO1lBRWxFLE1BQU0sSUFBQSxtQ0FBdUIsRUFDekIsSUFBSSxDQUFDLEVBQUUsSUFBSSxFQUFFLEVBQ2IsTUFBTSxDQUFDLE9BQU8sQ0FBQyxVQUFVLENBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxFQUFFLEVBQUUsRUFBRSxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxjQUFjLENBQUMsRUFDaEUsVUFBVSxDQUNiLENBQUE7UUFDTCxDQUFDLENBQUMsQ0FDTCxDQUFBO0lBQ0wsQ0FBQztBQUNMLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBEeW5hbW9EQkNsaWVudCB9IGZyb20gJ0Bhd3Mtc2RrL2NsaWVudC1keW5hbW9kYidcbmltcG9ydCB7IEdldEVudGl0aWVzLCBHZXRJdGVtcywgR2V0VXNlciB9IGZyb20gJy4vcXVlcmllcy9FbnRpdGllcydcbmltcG9ydCB7IGRlY3J5cHRJdGVtc0luQmF0Y2hlcyB9IGZyb20gJy4vcXVlcmllcy9FbmNyeXB0aW9uJ1xuaW1wb3J0IHsgbWFwRGRiUmVzcG9uc2VUb0l0ZW0gfSBmcm9tICcuL21hcHBlcnMvSXRlbSdcbmltcG9ydCB7IEhpZ2hMZXZlbFRyYW5zYWN0aW9uQ2F0ZWdvcnksIEl0ZW0sIFRyYW5zYWN0aW9uIH0gZnJvbSAnLi9BUEknXG5pbXBvcnQgeyBtYXBEeW5hbW9EQlRvVHJhbnNhY3Rpb24gfSBmcm9tICcuL21hcHBlcnMvVHJhbnNhY3Rpb25zJ1xuaW1wb3J0IHsgdXBsb2FkU3BlbmRpbmdTdW1tYXJpZXMgfSBmcm9tICcuL3F1ZXJpZXMvU3VtbWFyaWVzJ1xuXG5jb25zdCBjbGllbnQgPSBuZXcgRHluYW1vREJDbGllbnQoeyByZWdpb246ICdjYS1jZW50cmFsLTEnIH0pXG5cbmV4cG9ydCB0eXBlIERhaWx5U3BlbmRpbmdTdW1tYXJ5ID0ge1xuICAgIGRhdGU6IHN0cmluZ1xuICAgIHNwZW5kaW5nOiB7IFtjYXRlZ29yeSBpbiBIaWdoTGV2ZWxUcmFuc2FjdGlvbkNhdGVnb3J5XT86IG51bWJlciB9XG59XG5cbmV4cG9ydCB0eXBlIEFnZ3JlZ2F0ZWRTcGVuZGluZyA9IHtcbiAgICBkYWlseV9zcGVuZGluZzogRGFpbHlTcGVuZGluZ1N1bW1hcnlbXVxuICAgIHdlZWtseV9zcGVuZGluZzogeyBbY2F0ZWdvcnkgaW4gSGlnaExldmVsVHJhbnNhY3Rpb25DYXRlZ29yeV0/OiBudW1iZXIgfVxuICAgIG1vbnRobHlfc3BlbmRpbmc6IHsgW2NhdGVnb3J5IGluIEhpZ2hMZXZlbFRyYW5zYWN0aW9uQ2F0ZWdvcnldPzogbnVtYmVyIH1cbn1cblxudHlwZSBNb250aGx5U3BlbmRpbmdBZ2dyZWdhdGVzID0ge1xuICAgIFttb250aFllYXI6IHN0cmluZ106IEFnZ3JlZ2F0ZWRTcGVuZGluZ1xufVxuXG5mdW5jdGlvbiBhZ2dyZWdhdGVTcGVuZGluZ0J5Q2F0ZWdvcnkodHJhbnNhY3Rpb25zOiBUcmFuc2FjdGlvbltdKTogQWdncmVnYXRlZFNwZW5kaW5nIHtcbiAgICBjb25zdCBNU19JTl9BX0RBWSA9IDEwMDAgKiA2MCAqIDYwICogMjRcblxuICAgIC8vIEluaXRpYWxpemUgYWNjdW11bGF0b3JzXG4gICAgY29uc3QgZGFpbHlTcGVuZGluZ01hcDogeyBbZGF0ZTogc3RyaW5nXTogeyBbY2F0ZWdvcnkgaW4gSGlnaExldmVsVHJhbnNhY3Rpb25DYXRlZ29yeV0/OiBudW1iZXIgfSB9ID0ge31cbiAgICBjb25zdCB3ZWVrbHlTcGVuZGluZyA9IHt9IGFzIHsgW2NhdGVnb3J5IGluIEhpZ2hMZXZlbFRyYW5zYWN0aW9uQ2F0ZWdvcnldPzogbnVtYmVyIH1cbiAgICBjb25zdCBtb250aGx5U3BlbmRpbmcgPSB7fSBhcyB7IFtjYXRlZ29yeSBpbiBIaWdoTGV2ZWxUcmFuc2FjdGlvbkNhdGVnb3J5XT86IG51bWJlciB9XG5cbiAgICAvLyBTdGVwIDE6IFN1bSBhbW91bnRzIHBlciBjYXRlZ29yeSBieSBkYXlcbiAgICBmb3IgKGNvbnN0IHRyYW5zYWN0aW9uIG9mIHRyYW5zYWN0aW9ucykge1xuICAgICAgICBpZiAodHJhbnNhY3Rpb24uYW1vdW50ICYmIHRyYW5zYWN0aW9uLmRhdGUpIHtcbiAgICAgICAgICAgIGNvbnN0IGFtb3VudCA9IHBhcnNlRmxvYXQodHJhbnNhY3Rpb24uYW1vdW50KVxuICAgICAgICAgICAgY29uc3QgZGF0ZSA9IG5ldyBEYXRlKHRyYW5zYWN0aW9uLmRhdGUpXG4gICAgICAgICAgICBjb25zdCBkYXRlS2V5ID0gZGF0ZS50b0lTT1N0cmluZygpLnNwbGl0KCdUJylbMF0gLy8gRm9ybWF0IGRhdGUgYXMgWVlZWS1NTS1ERFxuXG4gICAgICAgICAgICAvLyBPbmx5IGNvbnNpZGVyIHRyYW5zYWN0aW9ucyB0aGF0IGFyZSBzcGVuZGluZywgbm90IGluY29tZSBvciB0cmFuc2ZlcnNcbiAgICAgICAgICAgIGNvbnN0IGNhdGVnb3J5ID0gdHJhbnNhY3Rpb24ucGVyc29uYWxfZmluYW5jZV9jYXRlZ29yeT8ucHJpbWFyeVxuICAgICAgICAgICAgaWYgKGNhdGVnb3J5KSB7XG4gICAgICAgICAgICAgICAgLy8gSW5pdGlhbGl6ZSBkYWlseSBzcGVuZGluZyBtYXAgZm9yIHRoZSBkYXRlIGlmIG5vdCBwcmVzZW50XG4gICAgICAgICAgICAgICAgaWYgKCFkYWlseVNwZW5kaW5nTWFwW2RhdGVLZXldKSB7XG4gICAgICAgICAgICAgICAgICAgIGRhaWx5U3BlbmRpbmdNYXBbZGF0ZUtleV0gPSB7fVxuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIC8vIEFnZ3JlZ2F0ZSBhbW91bnRzIGZvciBlYWNoIGNhdGVnb3J5IGluIGRhaWx5LCB3ZWVrbHksIGFuZCBtb250aGx5IG1hcHNcbiAgICAgICAgICAgICAgICBkYWlseVNwZW5kaW5nTWFwW2RhdGVLZXldW2NhdGVnb3J5XSA9IChkYWlseVNwZW5kaW5nTWFwW2RhdGVLZXldW2NhdGVnb3J5XSB8fCAwKSArIE1hdGguYWJzKGFtb3VudClcbiAgICAgICAgICAgICAgICB3ZWVrbHlTcGVuZGluZ1tjYXRlZ29yeV0gPSAod2Vla2x5U3BlbmRpbmdbY2F0ZWdvcnldIHx8IDApICsgTWF0aC5hYnMoYW1vdW50KVxuICAgICAgICAgICAgICAgIG1vbnRobHlTcGVuZGluZ1tjYXRlZ29yeV0gPSAobW9udGhseVNwZW5kaW5nW2NhdGVnb3J5XSB8fCAwKSArIE1hdGguYWJzKGFtb3VudClcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8vIENvbnZlcnQgZGFpbHkgc3BlbmRpbmcgbWFwIHRvIGFuIGFycmF5IG9mIERhaWx5U3BlbmRpbmdTdW1tYXJ5XG4gICAgY29uc3QgZGFpbHlTcGVuZGluZ1N1bW1hcmllczogRGFpbHlTcGVuZGluZ1N1bW1hcnlbXSA9IE9iamVjdC5lbnRyaWVzKGRhaWx5U3BlbmRpbmdNYXApLm1hcCgoW2RhdGUsIHNwZW5kaW5nXSkgPT4gKHtcbiAgICAgICAgZGF0ZSxcbiAgICAgICAgc3BlbmRpbmcsXG4gICAgfSkpXG5cbiAgICAvLyBTdGVwIDI6IENhbGN1bGF0ZSBkYXRlIHJhbmdlIGZvciBhdmVyYWdlc1xuICAgIGNvbnN0IHRyYW5zYWN0aW9uRGF0ZXMgPSBPYmplY3Qua2V5cyhkYWlseVNwZW5kaW5nTWFwKS5tYXAoKGRhdGUpID0+IG5ldyBEYXRlKGRhdGUpKVxuICAgIGlmICh0cmFuc2FjdGlvbkRhdGVzLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ05vIHZhbGlkIHRyYW5zYWN0aW9ucyBmb3VuZCB0byBhZ2dyZWdhdGUuJylcbiAgICB9XG5cbiAgICBjb25zdCBtaW5EYXRlID0gbmV3IERhdGUoTWF0aC5taW4oLi4udHJhbnNhY3Rpb25EYXRlcy5tYXAoKGRhdGUpID0+IGRhdGUuZ2V0VGltZSgpKSkpXG4gICAgY29uc3QgbWF4RGF0ZSA9IG5ldyBEYXRlKE1hdGgubWF4KC4uLnRyYW5zYWN0aW9uRGF0ZXMubWFwKChkYXRlKSA9PiBkYXRlLmdldFRpbWUoKSkpKVxuICAgIGNvbnN0IGR1cmF0aW9uSW5EYXlzID0gKG1heERhdGUuZ2V0VGltZSgpIC0gbWluRGF0ZS5nZXRUaW1lKCkpIC8gTVNfSU5fQV9EQVlcblxuICAgIC8vIFN0ZXAgMzogQ2FsY3VsYXRlIHdlZWtseSBhbmQgbW9udGhseSBhdmVyYWdlc1xuICAgIGZvciAoY29uc3QgY2F0ZWdvcnkgb2YgT2JqZWN0LmtleXMod2Vla2x5U3BlbmRpbmcpIGFzIEhpZ2hMZXZlbFRyYW5zYWN0aW9uQ2F0ZWdvcnlbXSkge1xuICAgICAgICBpZiAod2Vla2x5U3BlbmRpbmdbY2F0ZWdvcnldKSB3ZWVrbHlTcGVuZGluZ1tjYXRlZ29yeV0hIC89IGR1cmF0aW9uSW5EYXlzIC8gN1xuICAgICAgICBpZiAobW9udGhseVNwZW5kaW5nW2NhdGVnb3J5XSkgbW9udGhseVNwZW5kaW5nW2NhdGVnb3J5XSEgLz0gZHVyYXRpb25JbkRheXMgLyAzMFxuICAgIH1cblxuICAgIHJldHVybiB7XG4gICAgICAgIGRhaWx5X3NwZW5kaW5nOiBkYWlseVNwZW5kaW5nU3VtbWFyaWVzLFxuICAgICAgICB3ZWVrbHlfc3BlbmRpbmc6IHdlZWtseVNwZW5kaW5nLFxuICAgICAgICBtb250aGx5X3NwZW5kaW5nOiBtb250aGx5U3BlbmRpbmcsXG4gICAgfVxufVxuXG5mdW5jdGlvbiBncm91cFRyYW5zYWN0aW9uc0J5TW9udGgodHJhbnNhY3Rpb25zOiBUcmFuc2FjdGlvbltdKTogTW9udGhseVNwZW5kaW5nQWdncmVnYXRlcyB7XG4gICAgY29uc3QgbW9udGhseUFnZ3JlZ2F0ZXM6IE1vbnRobHlTcGVuZGluZ0FnZ3JlZ2F0ZXMgPSB7fVxuXG4gICAgY29uc3QgdHJhbnNhY3Rpb25zQnlNb250aDogeyBbbW9udGhZZWFyOiBzdHJpbmddOiBUcmFuc2FjdGlvbltdIH0gPSB0cmFuc2FjdGlvbnMucmVkdWNlKChhY2MsIHRyYW5zYWN0aW9uKSA9PiB7XG4gICAgICAgIGlmICh0cmFuc2FjdGlvbi5kYXRlKSB7XG4gICAgICAgICAgICBjb25zdCBkYXRlID0gbmV3IERhdGUodHJhbnNhY3Rpb24uZGF0ZSlcbiAgICAgICAgICAgIGNvbnN0IG1vbnRoWWVhciA9IGAke2RhdGUuZ2V0RnVsbFllYXIoKX0tJHtkYXRlLmdldE1vbnRoKCkgKyAxfWBcblxuICAgICAgICAgICAgaWYgKCFhY2NbbW9udGhZZWFyXSkge1xuICAgICAgICAgICAgICAgIGFjY1ttb250aFllYXJdID0gW11cbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgYWNjW21vbnRoWWVhcl0ucHVzaCh0cmFuc2FjdGlvbilcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gYWNjXG4gICAgfSwge30gYXMgeyBbbW9udGhZZWFyOiBzdHJpbmddOiBUcmFuc2FjdGlvbltdIH0pXG5cbiAgICBmb3IgKGNvbnN0IFttb250aFllYXIsIG1vbnRoVHJhbnNhY3Rpb25zXSBvZiBPYmplY3QuZW50cmllcyh0cmFuc2FjdGlvbnNCeU1vbnRoKSkge1xuICAgICAgICBtb250aGx5QWdncmVnYXRlc1ttb250aFllYXJdID0gYWdncmVnYXRlU3BlbmRpbmdCeUNhdGVnb3J5KG1vbnRoVHJhbnNhY3Rpb25zKVxuICAgIH1cblxuICAgIHJldHVybiBtb250aGx5QWdncmVnYXRlc1xufVxuZnVuY3Rpb24gZ2V0RWFybGllc3RGaXJzdE9mTW9udGhXaXRoaW45MERheXMoY3JlYXRlZEF0OiBEYXRlKSB7XG4gICAgY29uc3QgZGF0ZTkwRGF5c0FnbyA9IG5ldyBEYXRlKGNyZWF0ZWRBdClcbiAgICBkYXRlOTBEYXlzQWdvLnNldERhdGUoZGF0ZTkwRGF5c0Fnby5nZXREYXRlKCkgLSA5MClcblxuICAgIC8vIEdldCB0aGUgZmlyc3QgZGF5IG9mIHRoZSBjdXJyZW50IG1vbnRoIG9mIGBjcmVhdGVkQXRgXG4gICAgY29uc3QgZmlyc3RPZkN1cnJlbnRNb250aCA9IG5ldyBEYXRlKGNyZWF0ZWRBdC5nZXRGdWxsWWVhcigpLCBjcmVhdGVkQXQuZ2V0TW9udGgoKSwgMSlcblxuICAgIC8vIENoZWNrIGlmIHRoZSBmaXJzdCBkYXkgb2YgdGhlIGN1cnJlbnQgbW9udGggaXMgd2l0aGluIDkwIGRheXNcbiAgICBpZiAoZmlyc3RPZkN1cnJlbnRNb250aCA+PSBkYXRlOTBEYXlzQWdvKSB7XG4gICAgICAgIHJldHVybiBmaXJzdE9mQ3VycmVudE1vbnRoXG4gICAgfVxuXG4gICAgLy8gSWYgbm90LCByZXR1cm4gdGhlIGZpcnN0IGRheSBvZiB0aGUgZWFybGllc3QgbW9udGggd2l0aGluIHRoZSA5MC1kYXkgcmFuZ2VcbiAgICByZXR1cm4gbmV3IERhdGUoZGF0ZTkwRGF5c0Fnby5nZXRGdWxsWWVhcigpLCBkYXRlOTBEYXlzQWdvLmdldE1vbnRoKCksIDEpXG59XG5cbmV4cG9ydCBjb25zdCBjYWxjdWxhdGVJbmNvbWVBbmRTcGVuZGluZyA9IGFzeW5jICgpID0+IHtcbiAgICAvLyBUT0RPOiBBZGQgbG9naWMgdG8gaGFuZGxlIGxhc3QgY2FsY3VsYXRlZCBjb21wbGV0ZSBtb250aCBhbmQgc3RhcnQgZnJvbSB0aGVuXG4gICAgY29uc3QgaXRlbXMgPSAoYXdhaXQgZGVjcnlwdEl0ZW1zSW5CYXRjaGVzKChhd2FpdCBjbGllbnQuc2VuZChHZXRJdGVtcygpKSk/Lkl0ZW1zID8/IFtdKSkubWFwKG1hcERkYlJlc3BvbnNlVG9JdGVtKVxuICAgIC8qKiBUT0RPOiBKdXN0IGFkZCBjcmVhdGVkIGF0IHRvIHRoZSBpdGVtPyAqL1xuICAgIGNvbnN0IGVuY3J5cHRlZFVzZXJJdGVtUmVjb3JkID0gYXdhaXQgUHJvbWlzZS5hbGwoaXRlbXMubWFwKGFzeW5jIChlbCkgPT4gYXdhaXQgY2xpZW50LnNlbmQoR2V0VXNlcihlbC5zayB8fCAnJykpKSlcbiAgICBjb25zdCBkZWNyeXB0ZWRVc2VySXRlbVJlY29yZCA9IChhd2FpdCBkZWNyeXB0SXRlbXNJbkJhdGNoZXMoZW5jcnlwdGVkVXNlckl0ZW1SZWNvcmQpKS5tYXAobWFwRGRiUmVzcG9uc2VUb0l0ZW0pXG4gICAgLyoqIEdvIHRocm91Z2ggdXNlcnMgYW5kIGFnZ3JlZ2F0ZSB0cmFuc2FjdGlvbnMgKi9cbiAgICBhd2FpdCBwcm9jZXNzVXNlcnNJbkJhdGNoZXMoZGVjcnlwdGVkVXNlckl0ZW1SZWNvcmQpXG59XG5cbmZ1bmN0aW9uIGNodW5rQXJyYXk8VD4oYXJyYXk6IFRbXSwgY2h1bmtTaXplOiBudW1iZXIpOiBUW11bXSB7XG4gICAgY29uc3QgY2h1bmtzOiBUW11bXSA9IFtdXG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBhcnJheS5sZW5ndGg7IGkgKz0gY2h1bmtTaXplKSB7XG4gICAgICAgIGNodW5rcy5wdXNoKGFycmF5LnNsaWNlKGksIGkgKyBjaHVua1NpemUpKVxuICAgIH1cbiAgICByZXR1cm4gY2h1bmtzXG59XG5cbmFzeW5jIGZ1bmN0aW9uIHByb2Nlc3NVc2Vyc0luQmF0Y2hlcyhkZWNyeXB0ZWRVc2VySXRlbVJlY29yZDogSXRlbVtdKSB7XG4gICAgY29uc3QgdXNlckJhdGNoZXMgPSBjaHVua0FycmF5KGRlY3J5cHRlZFVzZXJJdGVtUmVjb3JkLCAxMDApXG4gICAgY29uc3Qgbm93ID0gbmV3IERhdGUoKSAvLyBHZXQgdGhlIGN1cnJlbnQgZGF0ZSBhbmQgdGltZVxuXG4gICAgZm9yIChjb25zdCBiYXRjaCBvZiB1c2VyQmF0Y2hlcykge1xuICAgICAgICBhd2FpdCBQcm9taXNlLmFsbChcbiAgICAgICAgICAgIGJhdGNoLm1hcChhc3luYyAoaXRlbSkgPT4ge1xuICAgICAgICAgICAgICAgIGNvbnN0IHN0YXJ0RGF5ID0gZ2V0RWFybGllc3RGaXJzdE9mTW9udGhXaXRoaW45MERheXMobmV3IERhdGUoaXRlbT8uY3JlYXRlZF9hdCA/PyAwKSlcblxuICAgICAgICAgICAgICAgIGNvbnN0IGVuY3J5cHRlZFRyYW5zYWN0aW9ucyA9IGF3YWl0IGNsaWVudC5zZW5kKFxuICAgICAgICAgICAgICAgICAgICBHZXRFbnRpdGllcyh7XG4gICAgICAgICAgICAgICAgICAgICAgICBwazogaXRlbS5wayA/PyAnJyxcbiAgICAgICAgICAgICAgICAgICAgICAgIGRhdGVSYW5nZToge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHN0YXJ0RGF5OiB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRheTogc3RhcnREYXkuZ2V0RGF0ZSgpICsgMSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbW9udGg6IHN0YXJ0RGF5LmdldE1vbnRoKCkgKyAxLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB5ZWFyOiBzdGFydERheS5nZXRGdWxsWWVhcigpLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZW5kRGF5OiB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRheTogbm93LmdldERhdGUoKSArIDEsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG1vbnRoOiBub3cuZ2V0TW9udGgoKSArIDEsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHllYXI6IG5vdy5nZXRGdWxsWWVhcigpLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaGFzTm9UaW1lQ29uc3RyYWludDogZmFsc2UsXG4gICAgICAgICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICAgICAgICAgdXNlcm5hbWU6ICcnLFxuICAgICAgICAgICAgICAgICAgICAgICAgaWQ6ICcnLFxuICAgICAgICAgICAgICAgICAgICAgICAgZW50aXR5TmFtZTogJ1RSQU5TQUNUSU9OJyxcbiAgICAgICAgICAgICAgICAgICAgfSlcbiAgICAgICAgICAgICAgICApXG5cbiAgICAgICAgICAgICAgICBjb25zdCBkZWNyeXB0ZWRUcmFuc2FjdGlvbnMgPSAoYXdhaXQgZGVjcnlwdEl0ZW1zSW5CYXRjaGVzKGVuY3J5cHRlZFRyYW5zYWN0aW9ucy5JdGVtcyA/PyBbXSkpLm1hcChcbiAgICAgICAgICAgICAgICAgICAgbWFwRHluYW1vREJUb1RyYW5zYWN0aW9uXG4gICAgICAgICAgICAgICAgKVxuXG4gICAgICAgICAgICAgICAgY29uc3QgYWdncmVnYXRlcyA9IGdyb3VwVHJhbnNhY3Rpb25zQnlNb250aChkZWNyeXB0ZWRUcmFuc2FjdGlvbnMpXG5cbiAgICAgICAgICAgICAgICBhd2FpdCB1cGxvYWRTcGVuZGluZ1N1bW1hcmllcyhcbiAgICAgICAgICAgICAgICAgICAgaXRlbS5wayA/PyAnJyxcbiAgICAgICAgICAgICAgICAgICAgT2JqZWN0LmVudHJpZXMoYWdncmVnYXRlcykuZmxhdE1hcCgoZWwpID0+IGVsWzFdLmRhaWx5X3NwZW5kaW5nKSxcbiAgICAgICAgICAgICAgICAgICAgYWdncmVnYXRlc1xuICAgICAgICAgICAgICAgIClcbiAgICAgICAgICAgIH0pXG4gICAgICAgIClcbiAgICB9XG59XG4iXX0=