// src/utils/apiResponse.ts
class ApiResponse<T = unknown> {
  data: T;
  message: string;
  statusCode: number;
  success: boolean;

  constructor(data: T, message = 'Success', statusCode = 200) {
    this.data = data;
    this.message = message;
    this.statusCode = statusCode;
    this.success = statusCode < 400;
  }
}

export default ApiResponse;