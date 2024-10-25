/* tslint:disable */
/* eslint-disable */
// this is an auto generated file. This will be overwritten

import * as APITypes from "../API";
type GeneratedMutation<InputType, OutputType> = string & {
  __generatedMutationInput: InputType;
  __generatedMutationOutput: OutputType;
};

export const createChat = /* GraphQL */ `mutation CreateChat($chat: ChatInput!) {
  createChat(chat: $chat) {
    pk
    sk
    message
    time
    isLastChunk
    messageId
    __typename
  }
}
` as GeneratedMutation<
  APITypes.CreateChatMutationVariables,
  APITypes.CreateChatMutation
>;
