// Quien registra un pedido suele copiar y pegar el teléfono, y con él se cuelan espacios,
// guiones, "+", paréntesis y caracteres invisibles (de ancho cero, espacios no separables, marcas
// de dirección...) que no se ven a simple vista. Todo lo que no sea un dígito 0-9 se reemplaza por
// nada.
export const sanitizePhone = (value: string): string => value.replace(/\D/g, '');

// Máximo de dígitos que acepta el backend (columna VARCHAR(20))
export const PHONE_MAX_DIGITS = 20;
