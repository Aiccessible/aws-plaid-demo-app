"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.retryCodeBuild = void 0;
const API_1 = require("./API");
const gpt_1 = require("./gpt");
const client_s3_1 = require("@aws-sdk/client-s3");
const stockPrompts_1 = require("./stockPrompts");
const s3 = new client_s3_1.S3Client({ region: process.env.AWS_REGION });
const retryCodeBuild = async (event, context) => {
    const user = event.identity?.username;
    let previousCodeRun = stockPrompts_1.previousCode;
    if (event.arguments.build.s3Key) {
        const bucketName = process.env.S3_BUCKET; // Ensure this environment variable is set
        const s3Key = event.arguments.build.s3Key;
        try {
            const command = new client_s3_1.GetObjectCommand({
                Bucket: bucketName,
                Key: s3Key,
            });
            const s3Response = await s3.send(command);
            if (s3Response.Body) {
                const bodyContents = await s3Response.Body.transformToString(); // Automatically convert to string
                previousCodeRun = bodyContents;
            }
            else {
                throw new Error('File content is empty or invalid.');
            }
        }
        catch (error) {
            console.error('Error fetching S3 file:', error);
            throw new Error('Failed to retrieve S3 file.');
        }
    }
    const message = `${previousCodeRun} Fix the following error ${event.arguments.build.error} Output the updated script as runnable code`;
    const response = await (0, gpt_1.completeChatFromPrompt)(message, API_1.ChatFocus.All, user, false, API_1.ChatType.RetryCodeBuild);
    const recommentations = JSON.parse(response || '');
    const newCode = recommentations.newCode;
    const newFileKey = user + '-' + Math.floor(Math.random() * 1000000);
    try {
        // Upload new code to S3
        const putCommand = new client_s3_1.PutObjectCommand({
            Bucket: process.env.S3_BUCKET,
            Key: newFileKey,
            Body: newCode,
            ContentType: 'application/javascript', // Assuming it's JS code
        });
        await s3.send(putCommand);
        console.log(`New code uploaded to S3: ${newFileKey}`);
    }
    catch (error) {
        console.error('Error uploading new code to S3:', error);
        throw new Error('Failed to upload new code to S3.');
    }
    await (0, gpt_1.sendChatToUI)(user, 'FinancialSimulationRepair', JSON.stringify({
        __typename: 'FinancialSimulationRepair',
        s3Key: newFileKey,
    }), true, user + Date.now().toString());
    return {
        __typename: 'FinancialSimulationExpansion',
        s3Key: newFileKey,
    };
};
exports.retryCodeBuild = retryCodeBuild;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicmV0cnlDb2RlQnVpbGQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi9zcmMvcmV0cnlDb2RlQnVpbGQudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7O0FBQ0EsK0JBQThGO0FBQzlGLCtCQUFrRztBQUNsRyxrREFBaUY7QUFDakYsaURBQTZDO0FBQzdDLE1BQU0sRUFBRSxHQUFHLElBQUksb0JBQVEsQ0FBQyxFQUFFLE1BQU0sRUFBRSxPQUFPLENBQUMsR0FBRyxDQUFDLFVBQVUsRUFBRSxDQUFDLENBQUE7QUFFcEQsTUFBTSxjQUFjLEdBQXFFLEtBQUssRUFDakcsS0FBMkQsRUFDM0QsT0FBZ0IsRUFDbEIsRUFBRTtJQUNBLE1BQU0sSUFBSSxHQUFJLEtBQUssQ0FBQyxRQUFtQyxFQUFFLFFBQVEsQ0FBQTtJQUVqRSxJQUFJLGVBQWUsR0FBRywyQkFBWSxDQUFBO0lBQ2xDLElBQUksS0FBSyxDQUFDLFNBQVMsQ0FBQyxLQUFLLENBQUMsS0FBSyxFQUFFLENBQUM7UUFDOUIsTUFBTSxVQUFVLEdBQUcsT0FBTyxDQUFDLEdBQUcsQ0FBQyxTQUFTLENBQUEsQ0FBQywwQ0FBMEM7UUFDbkYsTUFBTSxLQUFLLEdBQUcsS0FBSyxDQUFDLFNBQVMsQ0FBQyxLQUFLLENBQUMsS0FBSyxDQUFBO1FBRXpDLElBQUksQ0FBQztZQUNELE1BQU0sT0FBTyxHQUFHLElBQUksNEJBQWdCLENBQUM7Z0JBQ2pDLE1BQU0sRUFBRSxVQUFXO2dCQUNuQixHQUFHLEVBQUUsS0FBSzthQUNiLENBQUMsQ0FBQTtZQUVGLE1BQU0sVUFBVSxHQUFHLE1BQU0sRUFBRSxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsQ0FBQTtZQUV6QyxJQUFJLFVBQVUsQ0FBQyxJQUFJLEVBQUUsQ0FBQztnQkFDbEIsTUFBTSxZQUFZLEdBQUcsTUFBTSxVQUFVLENBQUMsSUFBSSxDQUFDLGlCQUFpQixFQUFFLENBQUEsQ0FBQyxrQ0FBa0M7Z0JBQ2pHLGVBQWUsR0FBRyxZQUFZLENBQUE7WUFDbEMsQ0FBQztpQkFBTSxDQUFDO2dCQUNKLE1BQU0sSUFBSSxLQUFLLENBQUMsbUNBQW1DLENBQUMsQ0FBQTtZQUN4RCxDQUFDO1FBQ0wsQ0FBQztRQUFDLE9BQU8sS0FBSyxFQUFFLENBQUM7WUFDYixPQUFPLENBQUMsS0FBSyxDQUFDLHlCQUF5QixFQUFFLEtBQUssQ0FBQyxDQUFBO1lBQy9DLE1BQU0sSUFBSSxLQUFLLENBQUMsNkJBQTZCLENBQUMsQ0FBQTtRQUNsRCxDQUFDO0lBQ0wsQ0FBQztJQUVELE1BQU0sT0FBTyxHQUFHLEdBQUcsZUFBZSw0QkFBNEIsS0FBSyxDQUFDLFNBQVMsQ0FBQyxLQUFLLENBQUMsS0FBSyw2Q0FBNkMsQ0FBQTtJQUN0SSxNQUFNLFFBQVEsR0FBRyxNQUFNLElBQUEsNEJBQXNCLEVBQUMsT0FBTyxFQUFFLGVBQVMsQ0FBQyxHQUFHLEVBQUUsSUFBSSxFQUFFLEtBQUssRUFBRSxjQUFRLENBQUMsY0FBYyxDQUFDLENBQUE7SUFDM0csTUFBTSxlQUFlLEdBQUcsSUFBSSxDQUFDLEtBQUssQ0FBQyxRQUFRLElBQUksRUFBRSxDQUF5QyxDQUFBO0lBQzFGLE1BQU0sT0FBTyxHQUFHLGVBQWUsQ0FBQyxPQUFPLENBQUE7SUFDdkMsTUFBTSxVQUFVLEdBQUcsSUFBSSxHQUFHLEdBQUcsR0FBRyxJQUFJLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxNQUFNLEVBQUUsR0FBRyxPQUFPLENBQUMsQ0FBQTtJQUVuRSxJQUFJLENBQUM7UUFDRCx3QkFBd0I7UUFDeEIsTUFBTSxVQUFVLEdBQUcsSUFBSSw0QkFBZ0IsQ0FBQztZQUNwQyxNQUFNLEVBQUUsT0FBTyxDQUFDLEdBQUcsQ0FBQyxTQUFTO1lBQzdCLEdBQUcsRUFBRSxVQUFVO1lBQ2YsSUFBSSxFQUFFLE9BQU87WUFDYixXQUFXLEVBQUUsd0JBQXdCLEVBQUUsd0JBQXdCO1NBQ2xFLENBQUMsQ0FBQTtRQUVGLE1BQU0sRUFBRSxDQUFDLElBQUksQ0FBQyxVQUFVLENBQUMsQ0FBQTtRQUV6QixPQUFPLENBQUMsR0FBRyxDQUFDLDRCQUE0QixVQUFVLEVBQUUsQ0FBQyxDQUFBO0lBQ3pELENBQUM7SUFBQyxPQUFPLEtBQUssRUFBRSxDQUFDO1FBQ2IsT0FBTyxDQUFDLEtBQUssQ0FBQyxpQ0FBaUMsRUFBRSxLQUFLLENBQUMsQ0FBQTtRQUN2RCxNQUFNLElBQUksS0FBSyxDQUFDLGtDQUFrQyxDQUFDLENBQUE7SUFDdkQsQ0FBQztJQUNELE1BQU0sSUFBQSxrQkFBWSxFQUNkLElBQUksRUFDSiwyQkFBMkIsRUFDM0IsSUFBSSxDQUFDLFNBQVMsQ0FBQztRQUNYLFVBQVUsRUFBRSwyQkFBMkI7UUFDdkMsS0FBSyxFQUFFLFVBQVU7S0FDcEIsQ0FBQyxFQUNGLElBQUksRUFDSixJQUFJLEdBQUcsSUFBSSxDQUFDLEdBQUcsRUFBRSxDQUFDLFFBQVEsRUFBRSxDQUMvQixDQUFBO0lBQ0QsT0FBTztRQUNILFVBQVUsRUFBRSw4QkFBOEI7UUFDMUMsS0FBSyxFQUFFLFVBQVU7S0FDcEIsQ0FBQTtBQUNMLENBQUMsQ0FBQTtBQW5FWSxRQUFBLGNBQWMsa0JBbUUxQiIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IEFwcFN5bmNJZGVudGl0eUNvZ25pdG8sIEFwcFN5bmNSZXNvbHZlckV2ZW50LCBBcHBTeW5jUmVzb2x2ZXJIYW5kbGVyLCBDb250ZXh0IH0gZnJvbSAnYXdzLWxhbWJkYSdcbmltcG9ydCB7IENoYXRGb2N1cywgQ2hhdFR5cGUsIEZpbmFuY2lhbFNpbXVsYXRpb25FeHBhbnNpb24sIFJldHJ5Q29kZUJ1aWxkSW5wdXQgfSBmcm9tICcuL0FQSSdcbmltcG9ydCB7IGNvbXBsZXRlQ2hhdEZyb21Qcm9tcHQsIHNlbmRDaGF0VG9VSSwgU2ltdWxhdGlvbkV4cGFuc2lvblJlc3BvbnNlSW50ZXJmYWNlIH0gZnJvbSAnLi9ncHQnXG5pbXBvcnQgeyBTM0NsaWVudCwgR2V0T2JqZWN0Q29tbWFuZCwgUHV0T2JqZWN0Q29tbWFuZCB9IGZyb20gJ0Bhd3Mtc2RrL2NsaWVudC1zMydcbmltcG9ydCB7IHByZXZpb3VzQ29kZSB9IGZyb20gJy4vc3RvY2tQcm9tcHRzJ1xuY29uc3QgczMgPSBuZXcgUzNDbGllbnQoeyByZWdpb246IHByb2Nlc3MuZW52LkFXU19SRUdJT04gfSlcblxuZXhwb3J0IGNvbnN0IHJldHJ5Q29kZUJ1aWxkOiBBcHBTeW5jUmVzb2x2ZXJIYW5kbGVyPGFueSwgRmluYW5jaWFsU2ltdWxhdGlvbkV4cGFuc2lvbiB8IHZvaWQ+ID0gYXN5bmMgKFxuICAgIGV2ZW50OiBBcHBTeW5jUmVzb2x2ZXJFdmVudDx7IGJ1aWxkOiBSZXRyeUNvZGVCdWlsZElucHV0IH0+LFxuICAgIGNvbnRleHQ6IENvbnRleHRcbikgPT4ge1xuICAgIGNvbnN0IHVzZXIgPSAoZXZlbnQuaWRlbnRpdHkgYXMgQXBwU3luY0lkZW50aXR5Q29nbml0byk/LnVzZXJuYW1lXG5cbiAgICBsZXQgcHJldmlvdXNDb2RlUnVuID0gcHJldmlvdXNDb2RlXG4gICAgaWYgKGV2ZW50LmFyZ3VtZW50cy5idWlsZC5zM0tleSkge1xuICAgICAgICBjb25zdCBidWNrZXROYW1lID0gcHJvY2Vzcy5lbnYuUzNfQlVDS0VUIC8vIEVuc3VyZSB0aGlzIGVudmlyb25tZW50IHZhcmlhYmxlIGlzIHNldFxuICAgICAgICBjb25zdCBzM0tleSA9IGV2ZW50LmFyZ3VtZW50cy5idWlsZC5zM0tleVxuXG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCBjb21tYW5kID0gbmV3IEdldE9iamVjdENvbW1hbmQoe1xuICAgICAgICAgICAgICAgIEJ1Y2tldDogYnVja2V0TmFtZSEsXG4gICAgICAgICAgICAgICAgS2V5OiBzM0tleSxcbiAgICAgICAgICAgIH0pXG5cbiAgICAgICAgICAgIGNvbnN0IHMzUmVzcG9uc2UgPSBhd2FpdCBzMy5zZW5kKGNvbW1hbmQpXG5cbiAgICAgICAgICAgIGlmIChzM1Jlc3BvbnNlLkJvZHkpIHtcbiAgICAgICAgICAgICAgICBjb25zdCBib2R5Q29udGVudHMgPSBhd2FpdCBzM1Jlc3BvbnNlLkJvZHkudHJhbnNmb3JtVG9TdHJpbmcoKSAvLyBBdXRvbWF0aWNhbGx5IGNvbnZlcnQgdG8gc3RyaW5nXG4gICAgICAgICAgICAgICAgcHJldmlvdXNDb2RlUnVuID0gYm9keUNvbnRlbnRzXG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcignRmlsZSBjb250ZW50IGlzIGVtcHR5IG9yIGludmFsaWQuJylcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoJ0Vycm9yIGZldGNoaW5nIFMzIGZpbGU6JywgZXJyb3IpXG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ0ZhaWxlZCB0byByZXRyaWV2ZSBTMyBmaWxlLicpXG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBjb25zdCBtZXNzYWdlID0gYCR7cHJldmlvdXNDb2RlUnVufSBGaXggdGhlIGZvbGxvd2luZyBlcnJvciAke2V2ZW50LmFyZ3VtZW50cy5idWlsZC5lcnJvcn0gT3V0cHV0IHRoZSB1cGRhdGVkIHNjcmlwdCBhcyBydW5uYWJsZSBjb2RlYFxuICAgIGNvbnN0IHJlc3BvbnNlID0gYXdhaXQgY29tcGxldGVDaGF0RnJvbVByb21wdChtZXNzYWdlLCBDaGF0Rm9jdXMuQWxsLCB1c2VyLCBmYWxzZSwgQ2hhdFR5cGUuUmV0cnlDb2RlQnVpbGQpXG4gICAgY29uc3QgcmVjb21tZW50YXRpb25zID0gSlNPTi5wYXJzZShyZXNwb25zZSB8fCAnJykgYXMgU2ltdWxhdGlvbkV4cGFuc2lvblJlc3BvbnNlSW50ZXJmYWNlXG4gICAgY29uc3QgbmV3Q29kZSA9IHJlY29tbWVudGF0aW9ucy5uZXdDb2RlXG4gICAgY29uc3QgbmV3RmlsZUtleSA9IHVzZXIgKyAnLScgKyBNYXRoLmZsb29yKE1hdGgucmFuZG9tKCkgKiAxMDAwMDAwKVxuXG4gICAgdHJ5IHtcbiAgICAgICAgLy8gVXBsb2FkIG5ldyBjb2RlIHRvIFMzXG4gICAgICAgIGNvbnN0IHB1dENvbW1hbmQgPSBuZXcgUHV0T2JqZWN0Q29tbWFuZCh7XG4gICAgICAgICAgICBCdWNrZXQ6IHByb2Nlc3MuZW52LlMzX0JVQ0tFVCxcbiAgICAgICAgICAgIEtleTogbmV3RmlsZUtleSxcbiAgICAgICAgICAgIEJvZHk6IG5ld0NvZGUsXG4gICAgICAgICAgICBDb250ZW50VHlwZTogJ2FwcGxpY2F0aW9uL2phdmFzY3JpcHQnLCAvLyBBc3N1bWluZyBpdCdzIEpTIGNvZGVcbiAgICAgICAgfSlcblxuICAgICAgICBhd2FpdCBzMy5zZW5kKHB1dENvbW1hbmQpXG5cbiAgICAgICAgY29uc29sZS5sb2coYE5ldyBjb2RlIHVwbG9hZGVkIHRvIFMzOiAke25ld0ZpbGVLZXl9YClcbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICBjb25zb2xlLmVycm9yKCdFcnJvciB1cGxvYWRpbmcgbmV3IGNvZGUgdG8gUzM6JywgZXJyb3IpXG4gICAgICAgIHRocm93IG5ldyBFcnJvcignRmFpbGVkIHRvIHVwbG9hZCBuZXcgY29kZSB0byBTMy4nKVxuICAgIH1cbiAgICBhd2FpdCBzZW5kQ2hhdFRvVUkoXG4gICAgICAgIHVzZXIsXG4gICAgICAgICdGaW5hbmNpYWxTaW11bGF0aW9uUmVwYWlyJyxcbiAgICAgICAgSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgICAgICAgX190eXBlbmFtZTogJ0ZpbmFuY2lhbFNpbXVsYXRpb25SZXBhaXInLFxuICAgICAgICAgICAgczNLZXk6IG5ld0ZpbGVLZXksXG4gICAgICAgIH0pLFxuICAgICAgICB0cnVlLFxuICAgICAgICB1c2VyICsgRGF0ZS5ub3coKS50b1N0cmluZygpXG4gICAgKVxuICAgIHJldHVybiB7XG4gICAgICAgIF9fdHlwZW5hbWU6ICdGaW5hbmNpYWxTaW11bGF0aW9uRXhwYW5zaW9uJyxcbiAgICAgICAgczNLZXk6IG5ld0ZpbGVLZXksXG4gICAgfVxufVxuIl19