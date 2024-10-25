import { createAsyncThunk, createSlice } from '@reduxjs/toolkit'
import { getFinancialConversationResponse, getInvestments } from '../graphql/queries'
import { ChatFocus, ChatType, Investment } from '../API'
import { RootState } from '../store'
import { GraphQLMethod } from '@aws-amplify/api-graphql'
// Define a type for the slice state

export interface InvestmentKnoweldgeViewModel {
    analysis: string
    news: string
    loadingAnalysis: boolean
    loadingNews: boolean
}
interface InvestmentsState {
    investments: Investment[] | undefined
    investmentSummary: string | undefined
    cursor: string | undefined
    loading: boolean
    loadingSummary: boolean
    error: string | undefined
    investmentKnoweldge: Record<string, InvestmentKnoweldgeViewModel>
    activeStock: string | undefined
}

// Define the initial state using that type
const initialState: InvestmentsState = {
    error: undefined,
    loading: false,
    investments: undefined,
    cursor: undefined,
    loadingSummary: false,
    investmentSummary: undefined,
    investmentKnoweldge: {},
    activeStock: undefined,
}

export interface GetInvestmentInput {
    client: { graphql: GraphQLMethod }
    id: string
    append: boolean
}

export interface GetInvestmentNewsInput {
    client: { graphql: GraphQLMethod }
    id: string
}

export interface GetInvestmentRecommendation {
    id: string
}

export const getInvestementsAsync = createAsyncThunk<
    any, // Return type
    GetInvestmentInput, // Input type
    { state: RootState } // ThunkAPI type that includes the state
>('investment/get-investments', async (input: GetInvestmentInput, getThunk) => {
    console.log(getThunk.getState())
    const res = await input.client.graphql({
        query: getInvestments,
        variables: { id: input.id, cursor: getThunk.getState().investments.cursor },
    })
    const errors = res.errors
    if (errors && errors.length > 0) {
        return { errors, investments: res.data?.getInvestments?.transactions }
    }
    return {
        investments: input.append
            ? [...(getThunk.getState() as any).investments.investments, ...res.data.getInvestments.transactions]
            : res.data.getInvestments.transactions,
        cursor: res.data.getInvestments.cursor,
        loading: false,
    }
})

const getStorageKey = (id: string) => {
    const currentDate = new Date().toISOString().split('T')[0] // Get the date in YYYY-MM-DD format
    return `newssummary-${id}-${currentDate}`
}

const getNewsKey = (id: string) => {
    const formattedDate = new Date().toISOString().replace('T', '-').split(':')[0]
    return `newsstocksummary-${id}-${formattedDate}`
}

const getAnalysisKey = (id: string) => {
    const formattedDate = new Date().toISOString().replace('T', '-').split(':')[0]
    return `analysissummary-${id}-${formattedDate}`
}

export const getInvestmentNewsSummary = createAsyncThunk<
    any, // Return type
    GetInvestmentNewsInput, // Input type
    { state: RootState } // ThunkAPI type that includes the state
>('investment/get-investment-news-summary', async (input: GetInvestmentNewsInput, getThunk) => {
    if (localStorage.getItem(getStorageKey(input.id))) {
        return { investmentSummary: localStorage.getItem(getStorageKey(input.id)) }
    }
    // TODO: Either add streaming ability or turn it off
    const res = await input.client.graphql({
        query: getFinancialConversationResponse,
        variables: {
            chat: {
                accountId: input.id ?? '',
                prompt: 'Provide me the news summary for the investments which I will send in the prompt as well',
                chatFocus: ChatFocus.Investment,
                chatType: ChatType.FinancialNewsQuery,
                requiresLiveData: true,
                shouldRagFetch: true,
            },
        },
    })
    res.data?.getFinancialConversationResponse?.response &&
        localStorage.setItem(getStorageKey(input.id), res.data?.getFinancialConversationResponse?.response)
    const errors = res.errors
    if (errors && errors.length > 0) {
        return { errors, investmentSummary: res.data?.getFinancialConversationResponse?.response }
    }
    return {
        investmentSummary: res.data.getFinancialConversationResponse?.response,
        loading: false,
    }
})

export const getInvestmentNews = createAsyncThunk<
    any, // Return type
    GetInvestmentNewsInput, // Input type
    { state: RootState } // ThunkAPI type that includes the state
>('investment/get-investment-news', async (input: GetInvestmentNewsInput, getThunk) => {
    if (localStorage.getItem(getNewsKey(input.id))) {
        return { value: localStorage.getItem(getNewsKey(input.id)), key: input.id }
    }
    // TODO: Either add streaming ability or turn it off
    const res = await input.client.graphql({
        query: getFinancialConversationResponse,
        variables: {
            chat: {
                accountId: input.id ?? '',
                prompt:
                    'Provide me the news summary for the investments which I will send in the prompt as well tickers' +
                    input.id,
                chatFocus: ChatFocus.Investment,
                chatType: ChatType.FinancialNewsQuery,
                requiresLiveData: true,
                shouldRagFetch: false,
            },
        },
    })
    res.data?.getFinancialConversationResponse?.response &&
        localStorage.setItem(getNewsKey(input.id), res.data?.getFinancialConversationResponse?.response)
    const errors = res.errors
    if (errors && errors.length > 0) {
        return { errors, value: res.data?.getFinancialConversationResponse?.response, key: input.id }
    }
    return {
        value: res.data.getFinancialConversationResponse?.response,
        loading: false,
        key: input.id,
    }
})

export const getInvestmentAnalysis = createAsyncThunk<
    any, // Return type
    GetInvestmentNewsInput, // Input type
    { state: RootState } // ThunkAPI type that includes the state
>('investment/get-investment-analysis', async (input: GetInvestmentNewsInput, getThunk) => {
    if (localStorage.getItem(getAnalysisKey(input.id))) {
        return { value: localStorage.getItem(getAnalysisKey(input.id)), key: input.id }
    }
    // TODO: Either add streaming ability or turn it off
    const res = await input.client.graphql({
        query: getFinancialConversationResponse,
        variables: {
            chat: {
                accountId: input.id ?? '',
                prompt:
                    'Provide me the technical analysis for the investments which I will send in the prompt as well tickers' +
                    input.id,
                chatFocus: ChatFocus.Investment,
                chatType: ChatType.FinancialNewsQuery,
                requiresLiveData: true,
                shouldRagFetch: false,
            },
        },
    })
    res.data?.getFinancialConversationResponse?.response &&
        localStorage.setItem(getAnalysisKey(input.id), res.data?.getFinancialConversationResponse?.response)
    const errors = res.errors
    if (errors && errors.length > 0) {
        return { errors, value: res.data?.getFinancialConversationResponse?.response, key: input.id }
    }
    return {
        value: res.data.getFinancialConversationResponse?.response,
        loading: false,
        key: input.id,
    }
})

export const investmentSlice = createSlice({
    name: 'investment',
    // `createSlice` will infer the state type from the `initialState` argument
    initialState,
    reducers: {
        removeError: (state) => {
            state.error = undefined
        },
        setActiveStock: (state, action) => {
            state.activeStock = action.payload
        },
    },
    extraReducers(builder) {
        builder.addCase(getInvestementsAsync.fulfilled, (state, action) => {
            console.log(action.payload)
            state.error = action.payload.errors ? action.payload.errors : undefined
            state.investments = action.payload.investments ?? []
            state.cursor = action.payload.cursor
            state.loading = false
        })
        builder.addCase(getInvestementsAsync.rejected, (state, action) => {
            state.error = 'Failed to fetch accounts because ' + action.error.message
            state.investments = (action.payload as any)?.investments ?? []
            state.loading = false
        })
        builder.addCase(getInvestementsAsync.pending, (state, action) => {
            state.error = undefined
            state.loading = true
        })
        builder.addCase(getInvestmentNewsSummary.fulfilled, (state, action) => {
            console.log(action.payload)
            state.error = action.payload.errors ? action.payload.errors : undefined
            state.investmentSummary = action.payload.investmentSummary ?? 'Could not get summary'
            state.loadingSummary = false
        })
        builder.addCase(getInvestmentNewsSummary.rejected, (state, action) => {
            state.error = 'Failed to summarize investments ' + action.error.message
            state.investmentSummary = (action.payload as any)?.investmentSummary ?? 'Could not get summary'
            state.loadingSummary = false
        })
        builder.addCase(getInvestmentNewsSummary.pending, (state, action) => {
            state.error = undefined
            state.loadingSummary = true
        })
        builder.addCase(getInvestmentNews.fulfilled, (state, action) => {
            state.error = action.payload.errors ? action.payload.errors : undefined
            state.investmentKnoweldge[action.payload.key ?? ''].news = action.payload.value ?? 'Could not get summary'
            state.investmentKnoweldge[action.payload.key ?? ''].loadingNews = false
        })
        builder.addCase(getInvestmentNews.rejected, (state, action) => {
            state.error = 'Failed to summarize investments ' + action.error.message
            state.investmentKnoweldge[(action.payload as any).key ?? ''].news =
                (action.payload as any).value ?? 'Could not get summary'
            state.investmentKnoweldge[(action.payload as any).key ?? ''].loadingNews = false
        })
        builder.addCase(getInvestmentNews.pending, (state, action) => {
            state.error = undefined
            state.investmentKnoweldge = {
                ...state.investmentKnoweldge,
                [action.meta.arg.id]: state.investmentKnoweldge[action.meta.arg.id] ?? {},
            }
            state.investmentKnoweldge[action.meta.arg.id].loadingNews = true
        })
        builder.addCase(getInvestmentAnalysis.fulfilled, (state, action) => {
            state.error = action.payload.errors ? action.payload.errors : undefined
            state.investmentKnoweldge[action.payload.key ?? ''].analysis =
                action.payload.value ?? 'Could not get summary'
            state.investmentKnoweldge[action.payload.key ?? ''].loadingAnalysis = false
        })
        builder.addCase(getInvestmentAnalysis.rejected, (state, action) => {
            state.error = 'Failed to summarize investments ' + action.error.message
            state.investmentKnoweldge[(action.payload as any).key ?? ''].analysis =
                (action.payload as any).value ?? 'Could not get summary'
            state.investmentKnoweldge[(action.payload as any).key ?? ''].loadingAnalysis = false
        })
        builder.addCase(getInvestmentAnalysis.pending, (state, action) => {
            state.error = undefined
            state.investmentKnoweldge = {
                ...state.investmentKnoweldge,
                [action.meta.arg.id]: state.investmentKnoweldge[action.meta.arg.id] ?? {},
            }
            state.investmentKnoweldge[action.meta.arg.id].loadingAnalysis = true
        })
    },
})

export const { removeError, setActiveStock } = investmentSlice.actions

// Other code such as selectors can use the imported `RootState` type

export default investmentSlice.reducer
