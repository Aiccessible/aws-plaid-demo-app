import { createAsyncThunk, createSelector, createSlice } from '@reduxjs/toolkit'
import { getSpendingSummary, getTransactions } from '../graphql/queries'
import { Account, HighLevelTransactionCategory, SpendingSummary, SpendingSummaryType, Transaction } from '../API'
import { GraphQLMethod } from '@aws-amplify/api-graphql'
import { stat } from 'fs'
import { RootState } from '../store'
import {
    calculateAverageSpendingFromMonthlySummarys,
    calculateTotalSpendingInCategories,
} from '../components/common/spendingUtils'
import { identifyAccountType } from '../components/Analysis/PersonalFinance'
// Define a type for the slice state
interface TransactionsState {
    acccountRecommendation: string
    transactions: Transaction[] | undefined
    cursor: string | undefined
    loading: boolean
    loadingDailySummary: boolean
    loadingMonthlySummary: boolean
    error: string | undefined
    dailySummaries: SpendingSummary[] | undefined
    monthlySummaries: SpendingSummary[] | undefined
    currentDateRange: number[] | undefined
}

const firstOfMonth = new Date()
firstOfMonth.setDate(1)
// Define the initial state using that type
const initialState: TransactionsState = {
    acccountRecommendation: '',
    error: undefined,
    loading: false,
    transactions: undefined,
    cursor: undefined,
    loadingDailySummary: false,
    loadingMonthlySummary: false,
    dailySummaries: undefined,
    monthlySummaries: undefined,
    currentDateRange: [firstOfMonth.getTime(), new Date().getTime()],
}

export interface GetTransactionInput {
    client: { graphql: GraphQLMethod }
    id: string
    append: boolean
}

export interface GetSummaryInput {
    client: { graphql: GraphQLMethod }
    append: boolean
}

export interface GetTransactionRecommendation {
    id: string
}

export const getTransactionsAsync = createAsyncThunk(
    'transaction/get-transactions',
    async (input: GetTransactionInput, getThunk: any) => {
        const res = await input.client.graphql({
            query: getTransactions,
            variables: { id: input.id, cursor: (getThunk.getState() as any).transactions.cursor },
        })
        const errors = res.errors
        if (errors && errors.length > 0) {
            return { errors, transactions: res.data.getTransactions }
        }
        return {
            transactions: input.append
                ? [
                      ...((getThunk.getState() as any).transactions.transactions ?? []),
                      ...res.data.getTransactions.transactions,
                  ]
                : res.data.getTransactions.transactions,
            cursor: res.data.getTransactions.cursor,
            loading: false,
        }
    }
)

export const getYesterdaySummaryAsyncThunk = createAsyncThunk<
    any, // Return type
    GetSummaryInput, // Input type
    { state: RootState } // ThunkAPI type that includes the state
>('transaction/get-transactions-summary-daily', async (input: GetSummaryInput, getThunk) => {
    let endDate
    let startDate
    if (getThunk.getState().transactions.currentDateRange) {
        startDate = getThunk.getState().transactions.currentDateRange?.[0] ?? new Date().getTime()
        endDate = getThunk.getState().transactions.currentDateRange?.[1] ?? new Date().getTime()
    } else {
        endDate = new Date()
        startDate = new Date()
        startDate.setDate(endDate.getDate() - 14)
        startDate = startDate.getTime()
        endDate = endDate.getTime()
    }
    const res = await input.client.graphql({
        query: getSpendingSummary,
        variables: {
            minDate: startDate as any,
            maxDate: endDate as any,
            type: SpendingSummaryType.DAILYSUMMARY,
            id: 'v0',
        },
    })
    return processSummaryResult(res)
})

const processSummaryResult = (res: any) => {
    const errors = res.errors
    if (errors && errors.length > 0) {
        return { errors, summarys: JSON.parse(res.data.getSpendingSummary.spending ?? '') }
    }

    return {
        summarys: JSON.parse(res.data.getSpendingSummary.spending ?? '').sort(
            (el: any, el2: any) => el2?.date - el?.date
        ),
        loadingSummary: false,
    }
}

export const getMonthlySummariesAsyncThunk = createAsyncThunk(
    'transaction/get-transactions-summary-monthly',
    async (input: GetSummaryInput, getThunk: any) => {
        console.log('here')
        const endDate = new Date() // Current date
        const startDate = new Date()
        startDate.setFullYear(endDate.getFullYear() - 1)
        console.log('here2')
        const res = await input.client.graphql({
            query: getSpendingSummary,
            variables: {
                minDate: startDate.getTime() as any,
                maxDate: endDate.getTime() as any,
                type: SpendingSummaryType.MONTHLYSUMMARY,
                id: 'v0',
            },
        })
        console.log('h232')
        console.error(res.data?.getSpendingSummary?.spending ?? '', 'geree', res.errors)
        return processSummaryResult(res)
    }
)

export const transactionSlice = createSlice({
    name: 'transaction',
    // `createSlice` will infer the state type from the `initialState` argument
    initialState,
    reducers: {
        removeError: (state) => (state.error = undefined),
        setCurrentDateRange: (state, action) => {
            state.currentDateRange = action.payload
        },
    },
    extraReducers(builder) {
        builder.addCase(getTransactionsAsync.fulfilled, (state, action) => {
            console.log(action.payload)
            state.error = action.payload.errors ? action.payload.errors.toString() : undefined
            state.transactions = (action.payload.transactions as any) ?? []
            state.cursor = action.payload.cursor || undefined
            state.loading = false
        })
        builder.addCase(getTransactionsAsync.rejected, (state, action) => {
            state.error = 'Failed to fetch accounts because ' + action.error.message
            state.transactions = (action.payload as any)?.transactions ?? []
            state.loading = false
        })
        builder.addCase(getTransactionsAsync.pending, (state, action) => {
            state.error = undefined
            state.loading = true
        })
        builder.addCase(getYesterdaySummaryAsyncThunk.fulfilled, (state, action) => {
            console.log(action.payload)
            state.error = action.payload.errors ? action.payload.errors.toString() : undefined
            state.loadingDailySummary = false
            state.dailySummaries = action.payload.summarys
        })
        builder.addCase(getYesterdaySummaryAsyncThunk.rejected, (state, action) => {
            state.loadingDailySummary = false
        })
        builder.addCase(getYesterdaySummaryAsyncThunk.pending, (state, action) => {
            state.error = undefined
            state.loadingDailySummary = true
        })
        builder.addCase(getMonthlySummariesAsyncThunk.fulfilled, (state, action) => {
            console.log(action.payload)
            state.error = action.payload.errors ? action.payload.errors.toString() : undefined
            state.loadingMonthlySummary = false
            state.monthlySummaries = action.payload.summarys
        })
        builder.addCase(getMonthlySummariesAsyncThunk.rejected, (state, action) => {
            state.error = 'Failed to fetch accounts because ' + action.error.message
            state.loadingMonthlySummary = false
        })
        builder.addCase(getMonthlySummariesAsyncThunk.pending, (state, action) => {
            state.error = undefined
            state.loadingMonthlySummary = true
        })
    },
})

export const { removeError, setCurrentDateRange } = transactionSlice.actions

// Other code such as selectors can use the imported `RootState` type

export default transactionSlice.reducer
const selectMonthlySummaries = (state: RootState) => state.transactions.monthlySummaries ?? []

export const selectRegisteredSavingsThisYear = createSelector([selectMonthlySummaries], (monthlySummaries) =>
    calculateTotalSpendingInCategories(
        monthlySummaries?.filter((el) => new Date((el as any).date).getFullYear() === new Date().getFullYear()) ?? [],
        [HighLevelTransactionCategory.TRANSFER_OUT_INVESTMENT_AND_RETIREMENT_FUNDS]
    )
)

export interface EstimatedRegisteredSavings {
    tfsa: number
    rrsp: number
    fhsa: number
}

const maxFhsa2024 = 8000
const maxTfsa2024 = 7000

const selectAccounts = (state: RootState) => state.accounts.accounts ?? []

export const selectRegisteredSavingsPerAccounts = createSelector(
    [selectAccounts, selectRegisteredSavingsThisYear],
    (accounts, registeredSavings) => {
        const rsp = accounts?.find((account: Account) => identifyAccountType(account) === 'RRSP')
        const tfsa = accounts?.find((account: Account) => identifyAccountType(account) === 'TFSA')
        const fhsa = accounts?.find((account: Account) => identifyAccountType(account) === 'FHSA')
        let estimatedTfsa = 0
        let estimatedRsp = 0
        let estimatedFhsa = 0
        if (
            tfsa &&
            registeredSavings[HighLevelTransactionCategory.TRANSFER_OUT_INVESTMENT_AND_RETIREMENT_FUNDS] > maxTfsa2024
        ) {
            estimatedTfsa = maxTfsa2024
            registeredSavings[HighLevelTransactionCategory.TRANSFER_OUT_INVESTMENT_AND_RETIREMENT_FUNDS] -=
                estimatedTfsa
        } else if (tfsa) {
            estimatedTfsa = registeredSavings[HighLevelTransactionCategory.TRANSFER_OUT_INVESTMENT_AND_RETIREMENT_FUNDS]
            return {
                estimatedTfsa,
                estimatedRsp,
                estimatedFhsa,
            }
        }

        if (
            fhsa &&
            registeredSavings[HighLevelTransactionCategory.TRANSFER_OUT_INVESTMENT_AND_RETIREMENT_FUNDS] > maxFhsa2024
        ) {
            estimatedFhsa = maxFhsa2024
            registeredSavings[HighLevelTransactionCategory.TRANSFER_OUT_INVESTMENT_AND_RETIREMENT_FUNDS] -= maxFhsa2024
        } else if (fhsa) {
            estimatedFhsa = registeredSavings[HighLevelTransactionCategory.TRANSFER_OUT_INVESTMENT_AND_RETIREMENT_FUNDS]
            return {
                estimatedTfsa,
                estimatedRsp,
                estimatedFhsa,
            }
        }

        if (rsp) {
            estimatedRsp = registeredSavings[HighLevelTransactionCategory.TRANSFER_OUT_INVESTMENT_AND_RETIREMENT_FUNDS]
            return {
                estimatedTfsa,
                estimatedRsp,
                estimatedFhsa,
            }
        }
    }
)
