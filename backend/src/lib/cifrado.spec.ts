import { describe, expect, it } from 'vitest';

// Clave de prueba (32 bytes); se fija antes de importar el módulo
process.env.CIFRADO_CLAVE = Buffer.alloc(32, 7).toString('base64');
const { cifrar, cifrarCi, cifrarEmail, cifrarFijo, descifrar, descifrarUsuario, estaCifrado } =
  await import('./cifrado.js');

describe('cifrado de datos de usuario', () => {
  it('cifra y descifra', () => {
    const valor = cifrar('77712345');
    expect(estaCifrado(valor)).toBe(true);
    expect(valor).not.toContain('77712345');
    expect(descifrar(valor)).toBe('77712345');
  });

  it('cifrar da un resultado distinto cada vez; cifrarFijo, siempre el mismo', () => {
    expect(cifrar('dato')).not.toBe(cifrar('dato'));
    expect(cifrarFijo('dato')).toBe(cifrarFijo('dato'));
    expect(cifrarFijo('dato')).not.toBe(cifrarFijo('dato2'));
  });

  it('normaliza el email y el ci antes de cifrar', () => {
    expect(cifrarEmail(' Ana@Mail.com ')).toBe(cifrarEmail('ana@mail.com'));
    expect(descifrar(cifrarEmail(' Ana@Mail.com '))).toBe('ana@mail.com');
    expect(cifrarCi(1234567)).toBe(cifrarCi(' 1234567 '));
  });

  it('deja tal cual los valores que no están cifrados', () => {
    expect(descifrar('1234567')).toBe('1234567');
    expect(descifrar(null)).toBeNull();
  });

  it('rechaza un valor cifrado alterado', () => {
    const valor = cifrar('secreto');
    const alterado = valor.slice(0, -2) + (valor.endsWith('A') ? 'BB' : 'AA');
    expect(() => descifrar(alterado)).toThrow();
  });

  it('descifra los tres campos de un usuario', () => {
    const u = { id: 'x', ci: cifrarCi('123'), email: cifrarEmail('a@b.c'), telefono: cifrar('700') };
    expect(descifrarUsuario(u)).toEqual({ id: 'x', ci: '123', email: 'a@b.c', telefono: '700' });
  });
});
