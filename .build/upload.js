"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handler = async (event) => {
    return {
        statusCode: 200,
        body: JSON.stringify({
            message: "Go Serverless v3.0! Your function executed successfully!",
            input: event,
        }, null, 2),
    };
};
//# sourceMappingURL=upload.js.map