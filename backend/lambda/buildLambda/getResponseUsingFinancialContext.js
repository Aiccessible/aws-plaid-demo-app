"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getResponseUsingFinancialContext = void 0;
const gpt_1 = require("./gpt");
const getResponseUsingFinancialContext = async (event, context) => {
    const response = await (0, gpt_1.completeChatFromPrompt)(event.arguments.prompt || '', event.arguments.chatFocus);
    return {
        response: response.content || '',
        __typename: 'ChatResponse',
    };
};
exports.getResponseUsingFinancialContext = getResponseUsingFinancialContext;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZ2V0UmVzcG9uc2VVc2luZ0ZpbmFuY2lhbENvbnRleHQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi9zcmMvZ2V0UmVzcG9uc2VVc2luZ0ZpbmFuY2lhbENvbnRleHQudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7O0FBRUEsK0JBQThDO0FBRXZDLE1BQU0sZ0NBQWdDLEdBQThDLEtBQUssRUFDNUYsS0FBc0MsRUFDdEMsT0FBZ0IsRUFDbEIsRUFBRTtJQUNBLE1BQU0sUUFBUSxHQUFHLE1BQU0sSUFBQSw0QkFBc0IsRUFBQyxLQUFLLENBQUMsU0FBUyxDQUFDLE1BQU0sSUFBSSxFQUFFLEVBQUUsS0FBSyxDQUFDLFNBQVMsQ0FBQyxTQUFTLENBQUMsQ0FBQTtJQUN0RyxPQUFPO1FBQ0gsUUFBUSxFQUFFLFFBQVEsQ0FBQyxPQUFPLElBQUksRUFBRTtRQUNoQyxVQUFVLEVBQUUsY0FBYztLQUM3QixDQUFBO0FBQ0wsQ0FBQyxDQUFBO0FBVFksUUFBQSxnQ0FBZ0Msb0NBUzVDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgQXBwU3luY1Jlc29sdmVyRXZlbnQsIEFwcFN5bmNSZXNvbHZlckhhbmRsZXIsIENvbnRleHQgfSBmcm9tICdhd3MtbGFtYmRhJ1xuaW1wb3J0IHsgQ2hhdFF1ZXJ5LCBDaGF0UmVzcG9uc2UgfSBmcm9tICcuL0FQSSdcbmltcG9ydCB7IGNvbXBsZXRlQ2hhdEZyb21Qcm9tcHQgfSBmcm9tICcuL2dwdCdcblxuZXhwb3J0IGNvbnN0IGdldFJlc3BvbnNlVXNpbmdGaW5hbmNpYWxDb250ZXh0OiBBcHBTeW5jUmVzb2x2ZXJIYW5kbGVyPGFueSwgQ2hhdFJlc3BvbnNlPiA9IGFzeW5jIChcbiAgICBldmVudDogQXBwU3luY1Jlc29sdmVyRXZlbnQ8Q2hhdFF1ZXJ5PixcbiAgICBjb250ZXh0OiBDb250ZXh0XG4pID0+IHtcbiAgICBjb25zdCByZXNwb25zZSA9IGF3YWl0IGNvbXBsZXRlQ2hhdEZyb21Qcm9tcHQoZXZlbnQuYXJndW1lbnRzLnByb21wdCB8fCAnJywgZXZlbnQuYXJndW1lbnRzLmNoYXRGb2N1cylcbiAgICByZXR1cm4ge1xuICAgICAgICByZXNwb25zZTogcmVzcG9uc2UuY29udGVudCB8fCAnJyxcbiAgICAgICAgX190eXBlbmFtZTogJ0NoYXRSZXNwb25zZScsXG4gICAgfVxufVxuIl19