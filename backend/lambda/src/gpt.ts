import OpenAI from 'openai'
import { any, z } from 'zod'
import { zodResponseFormat } from 'openai/helpers/zod'
import { AssistantToolChoice } from 'openai/resources/beta/threads/threads'
import { stat } from 'fs'
import { ChatFocus, ChatInput, ChatType } from './API'
import { createChat } from './graphql/mutations'
import { defaultProvider } from '@aws-sdk/credential-provider-node'
import * as aws4 from 'aws4'
import { SignatureV4 } from '@aws-sdk/signature-v4'
import { newsPrompt, technicalPrompt } from './stockPrompts'
const appsyncUrl = process.env.APPSYNC_URL as string
const apiKey = process.env.APPSYNC_API_KEY as string

const recommendationAction = z.object({
    description: z.string(),
    transfers: z.array(
        z.object({
            amount: z.string(),
            fromAccountName: z.string(),
            toAccountName: z.string(),
        })
    ),
})

const Recommendations = z.object({
    recommendations: z.array(
        z.object({
            explanation: z.string(),
            action: recommendationAction,
            title: z.string(),
            priority: z.enum(['High', 'Medium', 'Low']),
        })
    ),
})

/**
 * 
 * type GraphType {
    pieChart: String
    barChart: String
    histogram: String
    timePlot: String
}
 * type PremiumChatResponse {
    response: String
    graphs: GraphType
 */

const PremiumChatResponse = z.object({
    response: z.string(),
    graphs: z.object({
        pieChart: z.string(),
        barChart: z.string(),
        histogram: z.string(),
        timePlot: z.string(),
    }),
})

export interface Transfer {
    fromAccountName: string
    toAccountName: string
    amount: string
}
interface RecommendationAction {
    transfers: Transfer[]
    description: string
}

export interface Recommendation {
    explanation: string
    action: RecommendationAction
    title: string
    priority: number
}

export const apiClient = new OpenAI({
    apiKey: process.env['GptSecretKey']!,
    dangerouslyAllowBrowser: false,
})

const chat = apiClient.chat

export const getFinancialRecommendationsFromData = async (prompt: string) => {
    const chatOutput = await chat.completions.create({
        messages: [
            {
                role: 'system',
                content:
                    'You are a personal finance assistant. You leverage detailed knoweldge of jurisdictional tax laws and financial optimization strategies to guide us to make better financial decisions. Leave the transfer information empty if no transfer is needed',
            },
            {
                role: 'user',
                content: prompt.substring(0, 20000),
            },
        ],
        model: 'gpt-4o',
        response_format: zodResponseFormat(Recommendations, 'recommendations'),
    })
    return chatOutput.choices[0].message!
}

const makePerplexityCall = async (body: any) => {
    delete body['response_format']
    delete body['stream']
    const response = await fetch('https://api.perplexity.ai/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: process.env.PerplexitySecretKey,
        } as any,
        body: JSON.stringify(body),
    })
    if (!response.ok) {
        // Log the error response for debugging
        const errorText = await response.text()
        console.error('Error Response:', errorText)
        throw new Error(`API request failed with status ${response.status}: ${errorText}`)
    }

    try {
        return await response.json()
    } catch (error) {
        const responseText = await response.text()
        console.error('Failed to parse JSON. Response was:', responseText)
        throw new Error('API returned non-JSON response')
    }
}

async function processStreamedResponse(
    stream: Response,
    userId: string,
    messageId: string,
    firstFewLimit = 3,
    batchSize = 25
): Promise<string[]> {
    const reader = stream.body?.getReader()
    if (!reader) {
        throw new TypeError('Stream is not readable')
    }

    const decoder = new TextDecoder()
    let done = false
    let count = 0
    const message: string[] = []
    let buffer: string[] = []

    while (!done) {
        const { value, done: streamDone } = await reader.read()
        done = streamDone

        if (value) {
            const decodedChunk = decoder.decode(value, { stream: true })
            try {
                console.info('Got and decoded', decodedChunk, value)
                const parsedChunk: any = JSON.parse(decodedChunk)
                const content = parsedChunk.choices[0]?.delta?.content || ''

                if (count < firstFewLimit) {
                    // For the first few chunks, send immediately
                    console.info('Got:', content)
                    message.push(content)
                    sendChatToUI(userId, count.toString(), content, false, messageId)
                    count++
                } else {
                    // After the first few, accumulate chunks in a buffer
                    buffer.push(content)

                    // Once we've accumulated enough chunks (batchSize), send them as one combined message
                    if (buffer.length >= batchSize) {
                        const combinedMessage = buffer.join('')
                        console.info('Sending combined message:', combinedMessage)
                        sendChatToUI(userId, count.toString(), combinedMessage, false, messageId)
                        message.push(combinedMessage)

                        // Reset the buffer after sending
                        buffer = []
                        count++
                    }
                }
            } catch (error) {
                console.error('Error parsing chunk:', error, decodedChunk)
            }
        }
    }

    // If there's any remaining content in the buffer after the stream ends, send it
    const remainingMessage = buffer.join('')
    console.info('Sending remaining buffered message:', remainingMessage)
    sendChatToUI(userId, count.toString(), remainingMessage, true, messageId)
    message.push(remainingMessage)
    return message
}

export const completeChatFromPrompt = async (
    prompt: string,
    type: ChatFocus | null | undefined,
    userId: string,
    requiresLiveData: boolean,
    chatType: ChatType
) => {
    console.log('Sending', prompt, ' to gpt')
    const systemPrompt =
        chatType === ChatType.FinancialNewsQuery
            ? newsPrompt
            : chatType === ChatType.FinancialAnalysisQuery
            ? technicalPrompt
            : `You are a personal ${
                  type && type !== ChatFocus.All ? type : 'Finance'
              } assistant. You leverage detailed knoweldge of jurisdictional tax laws and financial optimization strategies to guide us to make better financial decisions. You plot data to beautiful svgs when it is helpful.`
    const model =
        chatType === ChatType.FinancialNewsQuery || chatType === ChatType.FinancialAnalysisQuery
            ? 'llama-3.1-sonar-large-128k-online'
            : 'gpt-4o'
    const messageBody = {
        messages: [
            {
                role: 'system',
                content: systemPrompt,
            },
            {
                role: 'user',
                content: prompt.substring(0, 20000),
            },
        ],
        response_format: zodResponseFormat(PremiumChatResponse, 'financialchatresponse'),
        model,
        stream: true,
    }
    const stream = requiresLiveData
        ? await makePerplexityCall(messageBody)
        : await chat.completions.create(messageBody as any)
    let message = []
    let count = 0
    let buffer: string[] = []
    const firstFewLimit = 3 // Send the first 3 chunks immediately
    const batchSize = 10 // Then combine 10 chunks at a time
    const messageId = userId + '#' + Date.now().toString()

    if (!requiresLiveData) {
        for await (const chunk of stream as any) {
            const content = chunk.choices[0]?.delta?.content || ''

            // For the first few chunks, send immediately
            if (count < firstFewLimit) {
                console.info('Got:', content)
                message.push(content)
                sendChatToUI(userId, count.toString(), content, false, messageId)
                count = count + 1
            } else {
                // After the first few, accumulate chunks in a buffer
                buffer.push(content)

                // Once we've accumulated enough chunks (batchSize), send them as one combined message
                if (buffer.length === batchSize) {
                    const combinedMessage = buffer.join('')
                    console.info('Sending combined message:', combinedMessage)
                    sendChatToUI(userId, count.toString(), combinedMessage, false, messageId)
                    message.push(combinedMessage)

                    // Reset the buffer after sending
                    buffer = []
                    count = count + 1
                }

                // Increment the counter even when buffering
            }
        }
    } else {
        message = [stream?.choices[0].message.content || '']
    }
    // If there are any remaining chunks in the buffer after the loop ends, send them
    if (buffer.length > 0) {
        const combinedMessage = buffer.join('')
        console.info('Sending final combined message:', combinedMessage)
        sendChatToUI(userId, count.toString(), combinedMessage, true, messageId)
        message.push(combinedMessage)
    } else {
        sendChatToUI(userId, count.toString(), '', true, messageId)
    }
    return message.join('')
}

export enum InformationOptions {
    'INVESTMENTS',
    'TRANSACTIONS',
    'BANKACCOUNTS',
}
export interface GptDateResponse {
    day: number
    month: number
    year: number
}
export interface DataRangeResponse {
    startDay: GptDateResponse
    endDay: GptDateResponse
    hasNoTimeConstraint: boolean
}

export interface InformationOptionsResponse {
    optionsForInformation: InformationOptions[]
}

function getFormattedCurrentDate(): string {
    const now = new Date() // Get the current date and time

    // Extract year, month, and day
    const year = now.getFullYear()
    const month = String(now.getMonth() + 1).padStart(2, '0') // Months are 0-based, so add 1
    const day = String(now.getDate()).padStart(2, '0')

    // Return the formatted date as 'YYYY-MM-DD'
    return `${year}-${month}-${day}`
}

export const getDateRangeFromModel = async (prompt: string) => {
    const AcceptableValuesForDateRange = z.object({
        startDay: z.object({
            day: z.number(),
            month: z.number(),
            year: z.number(),
        }),
        endDay: z.object({
            day: z.number(),
            month: z.number(),
            year: z.number(),
        }),
        hasNoTimeConstraint: z.boolean(),
    })
    const chatOutput = await chat.completions.create({
        messages: [
            {
                role: 'user',
                content:
                    'The current date is ' +
                    getFormattedCurrentDate() +
                    ' Fill out the best suited date range for the following query: ' +
                    prompt.substring(0, 100),
            },
        ],
        model: 'gpt-4o-mini',
        response_format: zodResponseFormat(AcceptableValuesForDateRange, 'dateRange'),
    })
    return chatOutput.choices[0].message!
}

export const getNeededInformationFromModel = async (prompt: string) => {
    console.log('Getting needed information')
    const AcceptableInformationOptions = z.object({
        optionsForInformation: z.array(z.enum(['INVESTMENTS', 'TRANSACTIONS', 'BANKACCOUNTS'])),
    })
    const chatOutput = await chat.completions.create({
        messages: [
            {
                role: 'user',
                content: 'What information is best suited to answer the following query: ' + prompt.substring(0, 100),
            },
        ],
        model: 'gpt-4o-mini',
        response_format: zodResponseFormat(AcceptableInformationOptions, 'dateRange'),
    })
    return chatOutput.choices[0].message!
}

const flatten = (value: any): any[] => {
    // If the value is an array, flatten each element recursively
    if (Array.isArray(value)) {
        return value.flatMap(flatten) // Use flatMap to flatten the array recursively
    }
    // If the value is an object, flatten its values recursively
    if (typeof value === 'object' && value !== null) {
        return flatten(Object.values(value))
    }
    // If the value is neither an array nor an object, return it as a single-element array
    return [value]
}

export const getTechnicalWordsWhereWeCanGoDeeper = async (prompt: string): Promise<string[]> => {
    try {
        const chatOutput = await chat.completions.create({
            messages: [
                {
                    role: 'system',
                    content:
                        'We are summarizing financial information return the exact phrases (include special characters and punctuation) where we could do financial analysis into the topic.  respond in the json format [phrase1, phrase2]]',
                },
                {
                    role: 'user',
                    content: prompt.substring(0, 20000),
                },
            ],
            response_format: { type: 'json_object' },
            model: 'gpt-3.5-turbo',
        })
        const jsonObject = JSON.parse(chatOutput.choices[0].message!.content || '')
        if (jsonObject.phrase1 || jsonObject.phrases || Object.keys(jsonObject).length > 0) {
            return flatten(Object.values(jsonObject))
        } else if (jsonObject.length) {
            return flatten(jsonObject)
        } else {
            return []
        }
    } catch (e) {
        return []
    }
}

export const createAssistant = async () =>
    apiClient.beta.assistants.create({
        instructions:
            'You are a personal finance assistant. You leverage detailed knoweldge of jurisdictional tax laws and financial optimization strategies to guide us to make better financial decisions. write and run code to answer the question.',
        model: 'gpt-4o-mini',
        tools: [{ type: 'code_interpreter' }],
    })

export const uploadFileToAssistant = async (file: File) => {
    // Upload a file with an "assistants" purpose
    const fileReturn = await apiClient.files.create({
        file: file,
        purpose: 'assistants',
    })
    return fileReturn
}

export const codeInterperterForAnalysis = async (fileIds: string[], assistant_id: string, prompt: string) => {
    const thread = await apiClient.beta.threads.create({
        messages: [
            {
                role: 'user',
                content: prompt,
                attachments: fileIds.map((fileId) => ({ file_id: fileId, tools: [{ type: 'code_interpreter' }] })),
            },
        ],
    })
    return thread
}

export const runThread = async (threadId: string, assistant_id: string) => {
    const runParams = {
        assistant_id: assistant_id,
        tool_choice: { type: 'code_interpreter' } as AssistantToolChoice,
    }
    const status = await apiClient.beta.threads.runs.createAndPoll(threadId, runParams)
    // Upload a file with an "assistants" purpose
    console.log(status)
    return status
}

export const listMessagesForThread = async (threadId: string) => {
    const messages = await apiClient.beta.threads.messages.list(threadId)
    // Upload a file with an "assistants" purpose
    console.log(messages)
    return messages
}

export const sendChatToUI = async (
    pk: string,
    sk: string,
    message: string,
    isLastChunk: boolean,
    messageId: string
) => {
    const chatInput: ChatInput = {
        pk: pk,
        sk: sk,
        message: message,
        time: Date.now().toString(),
        isLastChunk,
        messageId,
    }

    // Prepare GraphQL request payload
    const graphqlData = {
        query: createChat,
        variables: {
            chat: chatInput,
        },
    }
    const postBody = JSON.stringify(graphqlData)

    try {
        const credentials = await defaultProvider()()
        const uri = new URL(appsyncUrl)
        const httpRequest = {
            hostname: uri.hostname,
            path: uri.pathname,
            method: 'POST',
            headers: {
                host: uri.hostname,
                'Content-Type': 'application/json',
            },
            body: postBody,
        }

        // Create a signer object
        const signer = aws4.sign(
            {
                region: 'ca-central-1',
                service: 'appsync', // AppSync is the service we're interacting with
                path: httpRequest.path,
                headers: httpRequest.headers,
                method: httpRequest.method,
                body: httpRequest.body,
            },
            {
                accessKeyId: credentials.accessKeyId,
                secretAccessKey: credentials.secretAccessKey,
                sessionToken: credentials.sessionToken,
            }
        )

        // Sign the request
        Object.assign(httpRequest.headers, signer.headers)

        // Make the HTTP request
        const response = await fetch(uri.href, httpRequest)
        const json = await response.json()

        console.log(`JSON Response = ${JSON.stringify(json, null, 2)}`)
    } catch (error) {
        console.error(`FETCH ERROR: ${JSON.stringify(error, null, 2)}`)
    }
}
