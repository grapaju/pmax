import crypto from 'node:crypto';

function timingSafeEqualString(a, b) {
  const aa = Buffer.from(String(a ?? ''), 'utf8');
  const bb = Buffer.from(String(b ?? ''), 'utf8');
  if (aa.length !== bb.length) return false;
  return crypto.timingSafeEqual(aa, bb);
}

export function requireImportKey(req, res, next) {
  const expected = process.env.GOOGLE_ADS_SCRIPT_IMPORT_KEY;
  if (!expected) {
    return res.status(500).json({
      error: 'GOOGLE_ADS_SCRIPT_IMPORT_KEY não configurado no servidor',
      code: 'IMPORT_KEY_MISSING_ON_SERVER',
    });
  }

  const provided = req.header('x-import-key');
  if (!provided) {
    return res.status(401).json({
      error: 'Header x-import-key é obrigatório',
      code: 'IMPORT_KEY_REQUIRED',
    });
  }

  if (!timingSafeEqualString(provided, expected)) {
    return res.status(403).json({
      error: 'Token inválido',
      code: 'IMPORT_KEY_INVALID',
    });
  }

  next();
}
