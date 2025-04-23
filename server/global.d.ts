/**
 * Definições de tipos globais para o sistema
 */

import { DiagnosticResult } from './diagnostic-service';

declare global {
  /**
   * Variável para armazenar os resultados do diagnóstico mais recente
   */
  var latestDiagnosticResults: DiagnosticResult[];
}