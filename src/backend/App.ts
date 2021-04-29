import * as Cipher from '../common/Cipher';

import { ipcMain, systemPreferences } from 'electron';

import KeyMan from './KeyMan';
import MessageKeys from '../common/IPC';
import { createECDH } from 'crypto';

const AppKeys = {
  hasMnemonic: 'has-mnemonic',
};

class App {
  touchIDSupported = false;
  hasMnemonic = false;
  ipcSecureKey: Buffer;
  ipcSecureIv: Buffer;

  constructor() {
    this.touchIDSupported = systemPreferences.canPromptTouchID();
    this.hasMnemonic = systemPreferences.getUserDefault(AppKeys.hasMnemonic, 'boolean');

    ipcMain.handleOnce(MessageKeys.exchangeDHKey, (e, dh) => {
      const { rendererEcdhKey, ipcSecureIv } = dh;
      this.ipcSecureIv = ipcSecureIv;

      const ecdh = createECDH('secp521r1');
      const mainEcdhKey = ecdh.generateKeys();

      this.ipcSecureKey = ecdh.computeSecret(rendererEcdhKey);
      return mainEcdhKey;
    });

    ipcMain.handle(MessageKeys.getInitStatus, () => {
      return { hasMnemonic: this.hasMnemonic, touchIDSupported: this.touchIDSupported };
    });

    ipcMain.handle(`${MessageKeys.genMnemonic}-secure`, (e, encrypted) => {
      const { length } = this.decryptIpc(encrypted);
      return this.encryptIpc(KeyMan.genMnemonic(length));
    });

    ipcMain.handle(`${MessageKeys.saveMnemonic}-secure`, async (e, encrypted) => {
      if (this.hasMnemonic) return false;

      const { password: userPassword } = this.decryptIpc(encrypted);

      await KeyMan.savePassword(userPassword);
      await KeyMan.saveMnemonic(userPassword);
      systemPreferences.setUserDefault(AppKeys.hasMnemonic, 'boolean', true as never);
      this.hasMnemonic = true;

      return true;
    });
  }

  decryptIpc = (encrypted: string) => {
    const serialized = Cipher.decrypt(this.ipcSecureIv, encrypted, this.ipcSecureKey);
    return JSON.parse(serialized);
  };

  encryptIpc = (obj: any) => {
    return Cipher.encrypt(this.ipcSecureIv, JSON.stringify(obj), this.ipcSecureKey);
  };
}

export default new App();
