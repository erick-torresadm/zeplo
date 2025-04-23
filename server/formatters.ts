/**
 * Utilitários para formatação de dados
 */

/**
 * Formata uma data no padrão brasileiro (DD/MM/AAAA HH:MM:SS)
 * @param date Data a ser formatada
 * @returns String formatada no padrão brasileiro
 */
export function formatDateBrazilian(date: Date): string {
  return `${date.getDate().toString().padStart(2, '0')}/${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getFullYear()} ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}:${date.getSeconds().toString().padStart(2, '0')}`;
}

/**
 * Verifica se uma string está no formato de data brasileira
 * @param dateString String a ser verificada
 * @returns Verdadeiro se estiver no formato DD/MM/AAAA HH:MM:SS
 */
export function isBrazilianDateFormat(dateString: string): boolean {
  // Formato esperado DD/MM/AAAA HH:MM:SS ou DD/MM/AAAA, HH:MM:SS
  const regex = /^\d{2}\/\d{2}\/\d{4}[,]?\s\d{2}:\d{2}:\d{2}$/;
  return regex.test(dateString);
}

/**
 * Converte uma string de data no formato brasileiro para objeto Date
 * @param dateString String no formato DD/MM/AAAA HH:MM:SS
 * @returns Objeto Date ou null se o formato for inválido
 */
export function parseBrazilianDate(dateString: string): Date | null {
  try {
    if (!isBrazilianDateFormat(dateString)) {
      return null;
    }
    
    // Limpa a vírgula se existir
    const cleanDateString = dateString.replace(',', '').trim();
    
    // Divide em data e hora
    const [datePart, timePart] = cleanDateString.split(' ');
    
    // Processa a parte da data
    const [day, month, year] = datePart.split('/').map(n => parseInt(n, 10));
    
    // Processa a parte da hora
    const [hours, minutes, seconds] = timePart.split(':').map(n => parseInt(n, 10));
    
    // Cria o objeto Date (mês em JavaScript é base 0)
    const date = new Date(year, month - 1, day, hours, minutes, seconds);
    
    // Verifica se a data é válida
    if (isNaN(date.getTime())) {
      return null;
    }
    
    return date;
  } catch (error) {
    console.error('Erro ao converter data brasileira:', error);
    return null;
  }
}