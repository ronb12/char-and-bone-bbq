/**
 * Default staff login when env vars are unset (override with ADMIN_EMAIL / ADMIN_PASSWORD_HASH in production).
 * Password for default account: rotate via env, not by editing this file.
 */
const DEFAULT_ADMIN_EMAIL = 'ronellbradley@gmail.com';
const DEFAULT_ADMIN_PASSWORD_HASH =
  '$2b$10$oYRMGV/s2Nb6SmXK8bcAK.BiUS4udTnrjD4Imh29EPQgJ5cv0KVC2';

function getAdminEmail() {
  return String(process.env.ADMIN_EMAIL || DEFAULT_ADMIN_EMAIL)
    .trim()
    .toLowerCase();
}

function getAdminPasswordHash() {
  return process.env.ADMIN_PASSWORD_HASH || DEFAULT_ADMIN_PASSWORD_HASH;
}

module.exports = {
  getAdminEmail,
  getAdminPasswordHash,
};
