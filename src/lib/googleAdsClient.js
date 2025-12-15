import { GoogleAdsApi } from 'google-ads-api';

/**
 * Cliente Google Ads API
 * Gerencia autenticação e conexão com a API do Google Ads
 */

let client = null;
let customerCache = new Map();

/**
 * Inicializa o cliente Google Ads API
 * @param {Object} config - Configurações de autenticação
 * @returns {GoogleAdsApi} Cliente inicializado
 */
export function initializeGoogleAdsClient(config) {
  try {
    if (!config.clientId || !config.clientSecret || !config.developerToken) {
      throw new Error('Configurações Google Ads incompletas');
    }

    client = new GoogleAdsApi({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      developer_token: config.developerToken,
    });

    console.log('✓ Google Ads API client initialized');
    return client;
  } catch (error) {
    console.error('Erro ao inicializar Google Ads client:', error.message);
    throw error;
  }
}

/**
 * Obtém o cliente Google Ads
 * @returns {GoogleAdsApi} Cliente Google Ads
 */
export function getGoogleAdsClient() {
  if (!client) {
    throw new Error('Google Ads client não inicializado. Chame initializeGoogleAdsClient() primeiro.');
  }
  return client;
}

/**
 * Obtém um customer (conta) específico
 * @param {string} customerId - ID do cliente (sem hífens)
 * @param {string} refreshToken - Token de refresh OAuth
 * @param {string} loginCustomerId - ID do MCC (opcional)
 * @returns {Object} Customer object
 */
export function getCustomer(customerId, refreshToken, loginCustomerId = null) {
  if (!client) {
    throw new Error('Google Ads client não inicializado');
  }

  // Cache do customer para evitar recriar
  const cacheKey = `${customerId}-${refreshToken}`;
  
  if (customerCache.has(cacheKey)) {
    return customerCache.get(cacheKey);
  }

  const customerConfig = {
    customer_id: customerId.replace(/-/g, ''),
    refresh_token: refreshToken,
  };

  if (loginCustomerId) {
    customerConfig.login_customer_id = loginCustomerId.replace(/-/g, '');
  }

  const customer = client.Customer(customerConfig);
  customerCache.set(cacheKey, customer);

  return customer;
}

/**
 * Testa a conexão com uma conta Google Ads
 * @param {string} customerId - ID do cliente
 * @param {string} refreshToken - Token de refresh
 * @param {string} loginCustomerId - ID do MCC (opcional)
 * @returns {Promise<Object>} Informações da conta
 */
export async function testConnection(customerId, refreshToken, loginCustomerId = null) {
  try {
    const customer = getCustomer(customerId, refreshToken, loginCustomerId);

    const query = `
      SELECT 
        customer.id,
        customer.descriptive_name,
        customer.currency_code,
        customer.time_zone
      FROM customer
      LIMIT 1
    `;

    const [result] = await customer.query(query);

    return {
      success: true,
      customerId: result.customer.id,
      name: result.customer.descriptive_name,
      currency: result.customer.currency_code,
      timeZone: result.customer.time_zone,
    };
  } catch (error) {
    console.error('Erro ao testar conexão Google Ads:', error.message);
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Formata uma data para o formato GAQL (YYYY-MM-DD -> YYYYMMDD)
 * @param {Date|string} date - Data a formatar
 * @returns {string} Data formatada
 */
export function formatDateForGAQL(date) {
  const d = typeof date === 'string' ? new Date(date) : date;
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}${month}${day}`;
}

/**
 * Obtém um range de datas para queries
 * @param {number} days - Número de dias atrás
 * @returns {Object} Range com startDate e endDate
 */
export function getDateRange(days = 30) {
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  return {
    startDate: formatDateForGAQL(startDate),
    endDate: formatDateForGAQL(endDate),
    startDateObj: startDate,
    endDateObj: endDate,
  };
}

/**
 * Limpa o cache de customers
 */
export function clearCustomerCache() {
  customerCache.clear();
}

/**
 * Valida credenciais do Google Ads
 * @param {Object} credentials - Credenciais a validar
 * @returns {Object} Resultado da validação
 */
export function validateCredentials(credentials) {
  const errors = [];

  if (!credentials.clientId) errors.push('Client ID é obrigatório');
  if (!credentials.clientSecret) errors.push('Client Secret é obrigatório');
  if (!credentials.developerToken) errors.push('Developer Token é obrigatório');
  if (!credentials.refreshToken) errors.push('Refresh Token é obrigatório');
  if (!credentials.customerId) errors.push('Customer ID é obrigatório');

  // Validar formato do Customer ID
  if (credentials.customerId) {
    const cleanId = credentials.customerId.replace(/-/g, '');
    if (!/^\d{10}$/.test(cleanId)) {
      errors.push('Customer ID deve ter 10 dígitos');
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Converte micros para valor decimal
 * @param {number} micros - Valor em micros
 * @returns {number} Valor em unidades
 */
export function microsToUnits(micros) {
  return (micros || 0) / 1000000;
}

/**
 * Converte valor decimal para micros
 * @param {number} value - Valor em unidades
 * @returns {number} Valor em micros
 */
export function unitsToMicros(value) {
  return Math.round((value || 0) * 1000000);
}
