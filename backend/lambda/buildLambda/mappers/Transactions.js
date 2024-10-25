"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.mapTransactionToChatInput = exports.mapDynamoDBToTransaction = void 0;
// Mapper function for DynamoDB to Transaction interface
function mapDynamoDBToTransaction(item) {
    return {
        __typename: 'Transaction', // Fixed typename value
        transaction_id: item.transaction_id.S || '', // DynamoDB string type
        account_id: item.account_id?.S || null, // Nullable string
        amount: item.amount?.N || null, // Nullable string
        name: item.name?.S || null, // Nullable string
        iso_currency_code: item.iso_currency_code?.S || null, // Nullable string
        date: item.date?.S || null, // Nullable string
        payment_channel: item.payment_channel?.S || null, // Nullable string
        transaction_type: item.transaction_type?.S || null, // Nullable string
    };
}
exports.mapDynamoDBToTransaction = mapDynamoDBToTransaction;
const mapTransactionToChatInput = (transaction) => {
    let chatInput = '';
    // Build the chat input string using the fields in the Transaction object
    chatInput += `(Amount: ${transaction.amount ? `$${parseFloat(transaction.amount).toFixed(2)}` : 'N/A'}\n`;
    chatInput += `Name: ${transaction.name || 'N/A'}\n`;
    chatInput += `Currency: ${transaction.iso_currency_code || 'N/A'}\n`;
    chatInput += `Date: ${transaction.date || 'N/A'}\n`;
    chatInput += `Transaction Type: ${transaction.transaction_type || 'N/A'})\n`;
    return chatInput;
};
exports.mapTransactionToChatInput = mapTransactionToChatInput;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiVHJhbnNhY3Rpb25zLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vc3JjL21hcHBlcnMvVHJhbnNhY3Rpb25zLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7OztBQUdBLHdEQUF3RDtBQUN4RCxTQUFnQix3QkFBd0IsQ0FBQyxJQUF1QztJQUM1RSxPQUFPO1FBQ0gsVUFBVSxFQUFFLGFBQWEsRUFBRSx1QkFBdUI7UUFDbEQsY0FBYyxFQUFFLElBQUksQ0FBQyxjQUFjLENBQUMsQ0FBQyxJQUFJLEVBQUUsRUFBRSx1QkFBdUI7UUFDcEUsVUFBVSxFQUFFLElBQUksQ0FBQyxVQUFVLEVBQUUsQ0FBQyxJQUFJLElBQUksRUFBRSxrQkFBa0I7UUFDMUQsTUFBTSxFQUFFLElBQUksQ0FBQyxNQUFNLEVBQUUsQ0FBQyxJQUFJLElBQUksRUFBRSxrQkFBa0I7UUFDbEQsSUFBSSxFQUFFLElBQUksQ0FBQyxJQUFJLEVBQUUsQ0FBQyxJQUFJLElBQUksRUFBRSxrQkFBa0I7UUFDOUMsaUJBQWlCLEVBQUUsSUFBSSxDQUFDLGlCQUFpQixFQUFFLENBQUMsSUFBSSxJQUFJLEVBQUUsa0JBQWtCO1FBQ3hFLElBQUksRUFBRSxJQUFJLENBQUMsSUFBSSxFQUFFLENBQUMsSUFBSSxJQUFJLEVBQUUsa0JBQWtCO1FBQzlDLGVBQWUsRUFBRSxJQUFJLENBQUMsZUFBZSxFQUFFLENBQUMsSUFBSSxJQUFJLEVBQUUsa0JBQWtCO1FBQ3BFLGdCQUFnQixFQUFFLElBQUksQ0FBQyxnQkFBZ0IsRUFBRSxDQUFDLElBQUksSUFBSSxFQUFFLGtCQUFrQjtLQUN6RSxDQUFBO0FBQ0wsQ0FBQztBQVpELDREQVlDO0FBRU0sTUFBTSx5QkFBeUIsR0FBRyxDQUFDLFdBQXdCLEVBQVUsRUFBRTtJQUMxRSxJQUFJLFNBQVMsR0FBRyxFQUFFLENBQUE7SUFDbEIseUVBQXlFO0lBQ3pFLFNBQVMsSUFBSSxZQUFZLFdBQVcsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLElBQUksVUFBVSxDQUFDLFdBQVcsQ0FBQyxNQUFNLENBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsS0FBSyxJQUFJLENBQUE7SUFDekcsU0FBUyxJQUFJLFNBQVMsV0FBVyxDQUFDLElBQUksSUFBSSxLQUFLLElBQUksQ0FBQTtJQUNuRCxTQUFTLElBQUksYUFBYSxXQUFXLENBQUMsaUJBQWlCLElBQUksS0FBSyxJQUFJLENBQUE7SUFDcEUsU0FBUyxJQUFJLFNBQVMsV0FBVyxDQUFDLElBQUksSUFBSSxLQUFLLElBQUksQ0FBQTtJQUNuRCxTQUFTLElBQUkscUJBQXFCLFdBQVcsQ0FBQyxnQkFBZ0IsSUFBSSxLQUFLLEtBQUssQ0FBQTtJQUM1RSxPQUFPLFNBQVMsQ0FBQTtBQUNwQixDQUFDLENBQUE7QUFUWSxRQUFBLHlCQUF5Qiw2QkFTckMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBBdHRyaWJ1dGVWYWx1ZSB9IGZyb20gJ2F3cy1zZGsvY2xpZW50cy9keW5hbW9kYidcbmltcG9ydCB7IFRyYW5zYWN0aW9uIH0gZnJvbSAnLi4vQVBJJ1xuXG4vLyBNYXBwZXIgZnVuY3Rpb24gZm9yIER5bmFtb0RCIHRvIFRyYW5zYWN0aW9uIGludGVyZmFjZVxuZXhwb3J0IGZ1bmN0aW9uIG1hcER5bmFtb0RCVG9UcmFuc2FjdGlvbihpdGVtOiB7IFtrZXk6IHN0cmluZ106IEF0dHJpYnV0ZVZhbHVlIH0pOiBUcmFuc2FjdGlvbiB7XG4gICAgcmV0dXJuIHtcbiAgICAgICAgX190eXBlbmFtZTogJ1RyYW5zYWN0aW9uJywgLy8gRml4ZWQgdHlwZW5hbWUgdmFsdWVcbiAgICAgICAgdHJhbnNhY3Rpb25faWQ6IGl0ZW0udHJhbnNhY3Rpb25faWQuUyB8fCAnJywgLy8gRHluYW1vREIgc3RyaW5nIHR5cGVcbiAgICAgICAgYWNjb3VudF9pZDogaXRlbS5hY2NvdW50X2lkPy5TIHx8IG51bGwsIC8vIE51bGxhYmxlIHN0cmluZ1xuICAgICAgICBhbW91bnQ6IGl0ZW0uYW1vdW50Py5OIHx8IG51bGwsIC8vIE51bGxhYmxlIHN0cmluZ1xuICAgICAgICBuYW1lOiBpdGVtLm5hbWU/LlMgfHwgbnVsbCwgLy8gTnVsbGFibGUgc3RyaW5nXG4gICAgICAgIGlzb19jdXJyZW5jeV9jb2RlOiBpdGVtLmlzb19jdXJyZW5jeV9jb2RlPy5TIHx8IG51bGwsIC8vIE51bGxhYmxlIHN0cmluZ1xuICAgICAgICBkYXRlOiBpdGVtLmRhdGU/LlMgfHwgbnVsbCwgLy8gTnVsbGFibGUgc3RyaW5nXG4gICAgICAgIHBheW1lbnRfY2hhbm5lbDogaXRlbS5wYXltZW50X2NoYW5uZWw/LlMgfHwgbnVsbCwgLy8gTnVsbGFibGUgc3RyaW5nXG4gICAgICAgIHRyYW5zYWN0aW9uX3R5cGU6IGl0ZW0udHJhbnNhY3Rpb25fdHlwZT8uUyB8fCBudWxsLCAvLyBOdWxsYWJsZSBzdHJpbmdcbiAgICB9XG59XG5cbmV4cG9ydCBjb25zdCBtYXBUcmFuc2FjdGlvblRvQ2hhdElucHV0ID0gKHRyYW5zYWN0aW9uOiBUcmFuc2FjdGlvbik6IHN0cmluZyA9PiB7XG4gICAgbGV0IGNoYXRJbnB1dCA9ICcnXG4gICAgLy8gQnVpbGQgdGhlIGNoYXQgaW5wdXQgc3RyaW5nIHVzaW5nIHRoZSBmaWVsZHMgaW4gdGhlIFRyYW5zYWN0aW9uIG9iamVjdFxuICAgIGNoYXRJbnB1dCArPSBgKEFtb3VudDogJHt0cmFuc2FjdGlvbi5hbW91bnQgPyBgJCR7cGFyc2VGbG9hdCh0cmFuc2FjdGlvbi5hbW91bnQpLnRvRml4ZWQoMil9YCA6ICdOL0EnfVxcbmBcbiAgICBjaGF0SW5wdXQgKz0gYE5hbWU6ICR7dHJhbnNhY3Rpb24ubmFtZSB8fCAnTi9BJ31cXG5gXG4gICAgY2hhdElucHV0ICs9IGBDdXJyZW5jeTogJHt0cmFuc2FjdGlvbi5pc29fY3VycmVuY3lfY29kZSB8fCAnTi9BJ31cXG5gXG4gICAgY2hhdElucHV0ICs9IGBEYXRlOiAke3RyYW5zYWN0aW9uLmRhdGUgfHwgJ04vQSd9XFxuYFxuICAgIGNoYXRJbnB1dCArPSBgVHJhbnNhY3Rpb24gVHlwZTogJHt0cmFuc2FjdGlvbi50cmFuc2FjdGlvbl90eXBlIHx8ICdOL0EnfSlcXG5gXG4gICAgcmV0dXJuIGNoYXRJbnB1dFxufVxuIl19