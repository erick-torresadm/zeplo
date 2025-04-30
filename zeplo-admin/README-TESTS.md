# Testing the Backend Connection

This document provides information about testing the connection and functionality of the Zeplo backend API.

## Test Scripts

Several test scripts are provided to help you verify that the backend is running correctly and accessible from the frontend:

### 1. `test-backend.ps1` (PowerShell)

Tests the connection to the backend, detects the correct URL, and configures the frontend to use it.

```powershell
# In PowerShell
.\test-backend.ps1
```

### 2. `test-backend.bat` (Command Prompt)

Similar to the PowerShell script but runs in Command Prompt:

```cmd
test-backend.bat
```

### 3. `test-backend-specific.ps1` (PowerShell)

Tests specific API endpoints to verify backend functionality in detail:

```powershell
# In PowerShell
.\test-backend-specific.ps1
```

### 4. `start-backend.ps1` (PowerShell)

Attempts to start the backend server and then verifies the connection:

```powershell
# In PowerShell
.\start-backend.ps1
```

## Test Results

The test scripts will produce results that can help you identify if your backend is properly configured. Here's how to interpret the results:

### Backend Connection

- **Success**: Backend was detected on a port (usually port 8080)
- **Failure**: Backend could not be found on any port. Make sure the backend server is running.

### API Endpoints

The detailed test (`test-backend-specific.ps1`) checks the following endpoints:

- **Common Endpoints**: Root endpoint (/), status, health
- **Instance Endpoints**: `/instances`, `/instances/:id`
- **Flow Endpoints**: `/flows`, `/flows/:id`
- **Contact Endpoints**: `/contacts`, `/contacts/:id`
- **System Endpoints**: Database status, Redis status, Storage status

A successful test doesn't necessarily mean all endpoints return 200 OK. The test passes if the backend responds with any HTTP status code, even error codes. This is because some endpoints might not be implemented yet.

## Environment Configuration

After running the tests, a `.env.local` file will be created/updated with the correct backend URL:

```
NEXT_PUBLIC_API_URL=http://localhost:8080/api
```

This ensures that your frontend application can communicate with the backend.

## Manual Testing

If the automatic tests fail, you can manually test the backend connection:

1. Make sure the backend server is running:
   ```
   cd ../backend
   npm run dev
   ```

2. In a browser, navigate to:
   ```
   http://localhost:8080/api/flows
   ```

3. You should see some JSON data or an API response. If you get a network error, the server may not be running.

## Troubleshooting

If you encounter issues:

1. **Backend not running**: Make sure you've started the backend server with `npm run dev` in the backend directory.

2. **Wrong port**: If the backend is running on a different port, you can specify it when prompted by the test scripts.

3. **API path mismatch**: If the backend doesn't use `/api` prefix, the scripts should detect this automatically, but you might need to adjust your environment variables manually.

4. **Database connection issues**: If endpoints return 500 errors, check that your database connection is properly configured.

## Running Tests from NPM

You can also add these tests to your package.json scripts:

```json
"scripts": {
  "test:backend": "tsx src/tests/backend-tests.ts",
  "test:connection": "powershell -File ./test-backend.ps1"
}
```

Then run:

```
npm run test:connection
``` 