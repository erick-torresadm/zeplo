/**
 * Evolution API Test Runner
 * 
 * This script runs all the Evolution API integration tests in sequence
 * and provides a summary of the results.
 */

import { config } from 'dotenv';
import { spawn } from 'child_process';
import { logger } from '../src/utils/logger';
import path from 'path';
import fs from 'fs';

// Load environment variables
config();

interface TestResult {
  name: string;
  success: boolean;
  output: string;
  error: string;
  exitCode: number;
  startTime?: number;
  endTime?: number;
  logs?: string;
}

async function runTest(testName: string, command: string): Promise<TestResult> {
  const startTime = Date.now();
  
  logger.info(`Running test: ${testName}`);
  logger.info(`Command: ${command}`);
  
  return new Promise((resolve) => {
    const parts = command.split(' ');
    const cmd = parts[0];
    const args = parts.slice(1);
    
    const proc = spawn(cmd, args, { shell: true });
    
    let output = '';
    let error = '';
    
    proc.stdout.on('data', (data) => {
      const str = data.toString();
      output += str;
      process.stdout.write(str);
    });
    
    proc.stderr.on('data', (data) => {
      const str = data.toString();
      error += str;
      process.stderr.write(str);
    });
    
    proc.on('close', (code) => {
      const endTime = Date.now();
      const success = code === 0;
      
      const result: TestResult = {
        name: testName,
        success,
        output,
        error,
        exitCode: code || 0,
        startTime,
        endTime
      };
      
      logger.info(`Test ${testName} ${success ? 'succeeded' : 'failed'} with exit code ${code}`);
      logger.info(`Duration: ${(endTime - startTime) / 1000} seconds`);
      
      resolve(result);
    });
  });
}

async function runAllTests() {
  logger.info('=== EVOLUTION API TEST SUITE ===');
  logger.info('Starting all Evolution API integration tests');
  logger.info('==================================\n');
  
  const testResults: TestResult[] = [];
  
  try {
    // 1. Run basic API test to verify connectivity
    testResults.push(
      await runTest(
        'Basic API Connection', 
        'npx ts-node src/test-evolution.ts'
      )
    );
    
    // 2. Run the full API integration test 
    testResults.push(
      await runTest(
        'API Feature Integration', 
        'npx ts-node scripts/test-evolution-api-integration.ts'
      )
    );
    
    // 3. Run webhook integration test
    testResults.push(
      await runTest(
        'Webhook Integration', 
        'npx ts-node scripts/test-webhook-integration.ts'
      )
    );
    
    // Print summary
    printSummary(testResults);
    
    // Generate report
    const reportPath = generateReport(testResults);
    logger.info(`Full test report saved to: ${reportPath}`);
    
  } catch (error: any) {
    logger.error('Test execution failed:', error.message);
  }
}

function printSummary(results: TestResult[]) {
  const total = results.length;
  const succeeded = results.filter(r => r.success).length;
  const failed = total - succeeded;
  
  logger.info('\n=== TEST SUMMARY ===');
  logger.info(`Total tests run: ${total}`);
  logger.info(`Succeeded: ${succeeded}`);
  logger.info(`Failed: ${failed}`);
  
  if (failed > 0) {
    logger.info('\nFailed tests:');
    results
      .filter(r => !r.success)
      .forEach(r => {
        logger.info(`- ${r.name}`);
      });
  }
  
  logger.info('====================\n');
}

function generateReport(results: TestResult[]): string {
  const reportDir = path.join(process.cwd(), 'test-reports');
  
  // Create reports directory if it doesn't exist
  if (!fs.existsSync(reportDir)) {
    fs.mkdirSync(reportDir, { recursive: true });
  }
  
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const reportPath = path.join(reportDir, `evolution-api-test-report-${timestamp}.json`);
  
  // Create report data
  const reportData = {
    timestamp: new Date().toISOString(),
    summary: {
      total: results.length,
      succeeded: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length,
    },
    duration: results.reduce((total, r) => {
      return total + ((r.endTime || 0) - (r.startTime || 0));
    }, 0) / 1000,
    environment: {
      nodeVersion: process.version,
      evolutionApiUrl: process.env.EVOLUTION_API_URL,
    },
    tests: results.map(r => ({
      name: r.name,
      success: r.success,
      exitCode: r.exitCode,
      duration: ((r.endTime || 0) - (r.startTime || 0)) / 1000,
      errorSummary: r.error ? r.error.split('\n')[0] : null,
    }))
  };
  
  // Write report to file
  fs.writeFileSync(reportPath, JSON.stringify(reportData, null, 2));
  
  return reportPath;
}

// Run the tests
runAllTests().catch(error => {
  logger.error('Test execution failed:', error);
  process.exit(1);
}); 