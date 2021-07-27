import { systemPreferences } from 'electron';

const isWin = process.platform === 'win32';

const { UserConsentVerifier, UserConsentVerifierAvailability, UserConsentVerificationResult } = isWin
  ? require('@nodert-win10-20h1/windows.security.credentials.ui')
  : { UserConsentVerifier: undefined, UserConsentVerificationResult: undefined, UserConsentVerifierAvailability: undefined };

async function checkWindowsTouchIDSupported() {
  return new Promise<boolean>((resolve) => {
    UserConsentVerifier.checkAvailabilityAsync((err, result) => {
      if (err) return resolve(false);
      resolve(result === UserConsentVerifierAvailability.available);
    });
  });
}

async function verifyWindowsTouchID(msg: string) {
  return new Promise<boolean>((resolve) => {
    UserConsentVerifier.requestVerificationAsync(msg, (err, result) => {
      if (err) return resolve(false);
      resolve(result === UserConsentVerificationResult.verified);
    });
  });
}

export async function isTouchIDSupported() {
  switch (process.platform) {
    case 'darwin':
      return systemPreferences.canPromptTouchID();

    case 'win32':
      return await checkWindowsTouchIDSupported();
  }

  return false;
}

export async function verifyTouchID(msg: string) {
  switch (process.platform) {
    case 'darwin':
      try {
        await systemPreferences.promptTouchID(msg);
        return true;
      } catch (error) {
        return false;
      }

    case 'win32':
      return verifyWindowsTouchID(msg);
  }

  return false;
}
