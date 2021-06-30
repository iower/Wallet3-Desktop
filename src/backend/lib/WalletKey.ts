import * as Cipher from '../../common/Cipher';
import * as crypto from 'crypto';
import * as ethSignUtil from 'eth-sig-util';
import * as ethers from 'ethers';
import * as keytar from 'keytar';

import Key, { AccountType } from '../models/Key';

import { TxParams } from '../../common/Messages';

const BasePath = `m/44\'/60\'/0\'/0`;
const prod = process.env.NODE_ENV === 'production';

const Keys = {
  password: 'wallet3-password',
  secret: 'wallet3-secret',
  masterAccount: (machine_id: string) => (prod ? `wallet3-master-${machine_id}` : `wallet3-dev-master-${machine_id}`),
  secretAccount: (kc_unique: string) => (prod ? `wallet3-account-${kc_unique}` : `wallet3-dev-account-${kc_unique}`),
};

export class WalletKey {
  basePath = BasePath;
  basePathIndex = 0;
  hasSecret = false;

  private tmpSecret?: string;
  private key: Key;

  get id() {
    return this.key?.id;
  }

  private get tmpSecretType() {
    if (!this.tmpSecret) return undefined;

    return this.checkSecretType(this.tmpSecret);
  }

  async init(key: Key) {
    this.key = key;

    this.basePath = this.key?.basePath ?? BasePath;
    this.basePathIndex = this.key?.basePathIndex ?? 0;

    this.hasSecret =
      this.key?.kc_unique && this.key?.mnIv
        ? (await keytar.getPassword(Keys.secret, Keys.secretAccount(this.key.kc_unique)))
          ? true
          : false
        : false;
  }

  async setFullPath(fullPath: string) {
    const lastSlash = fullPath.lastIndexOf('/');
    this.basePath = fullPath.substring(0, lastSlash);
    this.basePathIndex = Number.parseInt(fullPath.substring(lastSlash + 1)) || 0;

    if (!this.key) return;

    this.key.basePath = this.basePath;
    this.key.basePathIndex = this.basePathIndex;
    await this.key.save();
  }

  async verifyPassword(userPassword: string) {
    try {
      const user = Cipher.sha256(this.getCorePassword(userPassword)).toString('hex');
      return user === (await keytar.getPassword(Keys.password, Keys.masterAccount('default')));
    } catch (error) {
      console.error(error.message);
      return false;
    }
  }

  async savePassword(userPassword: string) {
    const [saltIv, salt] = Cipher.encrypt(Cipher.generateIv().toString('hex'), userPassword);
    this.key = this.key ?? new Key();
    this.key.saltIv = saltIv;
    this.key.salt = salt;

    await this.key.save();

    const pwHash = Cipher.sha256(this.getCorePassword(userPassword)).toString('hex');
    await keytar.setPassword(Keys.password, Keys.masterAccount('default'), pwHash);
  }

  genMnemonic(length = 12) {
    const entropy = crypto.randomBytes(length === 12 ? 16 : 32);
    this.tmpSecret = ethers.utils.entropyToMnemonic(entropy);

    const wallet = ethers.Wallet.fromMnemonic(this.tmpSecret);
    return { mnemonic: this.tmpSecret, address: wallet.address };
  }

  setTmpSecret(mnemonic: string) {
    this.tmpSecret = mnemonic;
    return this.tmpSecretType !== undefined;
  }

  async saveSecret(userPassword: string) {
    if (!this.tmpSecret) return false;
    if (this.tmpSecretType === undefined) return false;

    if (!(await this.verifyPassword(userPassword))) return false;

    this.key.kc_unique = this.key.kc_unique ?? crypto.randomBytes(4).toString('hex');
    this.key.basePath = this.basePath;
    this.key.basePathIndex = this.basePathIndex;
    this.key.type = this.tmpSecretType;

    const [mnIv, encryptedSecret] = Cipher.encrypt(this.tmpSecret, this.getCorePassword(userPassword));
    this.key.mnIv = mnIv;

    await this.key.save();
    await keytar.setPassword(Keys.secret, Keys.secretAccount(this.key.kc_unique), encryptedSecret);

    this.tmpSecret = undefined;
    this.hasSecret = true;

    return true;
  }

  async readSecret(userPassword: string) {
    if (!(await this.verifyPassword(userPassword))) return undefined;

    try {
      const iv = this.key.mnIv;
      const enSecret = await keytar.getPassword(Keys.secret, Keys.secretAccount(this.key.kc_unique));

      return Cipher.decrypt(Buffer.from(iv, 'hex'), enSecret, this.getCorePassword(userPassword));
    } catch (error) {
      console.error(error.message);
      return undefined;
    }
  }

  async signTx(userPassword: string, accountIndex = 0, txParams: TxParams) {
    const privKey = await this.getPrivateKey(userPassword, accountIndex);
    if (!privKey) return '';

    const signer = new ethers.Wallet(privKey);
    return await signer.signTransaction({
      to: txParams.to,
      chainId: txParams.chainId,
      data: txParams.data,
      nonce: txParams.nonce,
      gasLimit: ethers.BigNumber.from(txParams.gas),
      gasPrice: ethers.BigNumber.from(txParams.gasPrice),
      value: ethers.BigNumber.from(txParams.value),
    });
  }

  async personalSignMessage(userPassword: string, accountIndex = 0, msg: string | ethers.utils.Bytes) {
    const privKey = await this.getPrivateKey(userPassword, accountIndex);
    if (!privKey) return '';

    const signer = new ethers.Wallet(privKey);
    return await signer.signMessage(typeof msg === 'string' ? ethers.utils.arrayify(msg) : msg);
  }

  async signTypedData_v4(userPassword: string, accountIndex = 0, typedData: any) {
    const privKey = await this.getPrivateKey(userPassword, accountIndex);
    if (!privKey) return '';

    return ethSignUtil.signTypedData_v4(Buffer.from(ethers.utils.arrayify(privKey)), { data: typedData });
  }

  async genAddresses(userPassword: string, count: number) {
    const secret = await this.readSecret(userPassword);
    if (!secret) return undefined;

    switch (this.checkSecretType(secret)) {
      case AccountType.mnemonic:
        const hd = ethers.utils.HDNode.fromMnemonic(secret);
        const addresses = [hd.derivePath(`${this.basePath}/${this.basePathIndex}`).address];

        for (let i = 1; i < count; i++) {
          addresses.push(hd.derivePath(`${this.basePath}/${this.basePathIndex + i}`).address);
        }

        return addresses;

      case AccountType.privkey:
        const signer = new ethers.Wallet(secret);
        return [signer.address];
    }
  }

  async reset(password: string, viaPassword = true) {
    if (viaPassword && !(await this.verifyPassword(password))) return false;

    this.hasSecret = false;
    this.basePath = BasePath;
    this.basePathIndex = 0;

    await keytar.deletePassword(Keys.secret, Keys.secretAccount(this.key.kc_unique));
    await this.key?.remove();

    this.key = undefined;
  }

  private async getPrivateKey(userPassword: string, accountIndex = 0) {
    const secret = await this.readSecret(userPassword);
    if (!secret) return undefined;

    switch (this.checkSecretType(secret)) {
      case AccountType.mnemonic:
        const root = ethers.utils.HDNode.fromMnemonic(secret);
        const account = root.derivePath(`${this.basePath}/${this.basePathIndex + accountIndex}`);
        return account.privateKey;

      case AccountType.privkey:
        return secret;
    }
  }

  private checkSecretType(secret: string) {
    if (ethers.utils.isValidMnemonic(secret)) return AccountType.mnemonic;

    if ((secret.toLowerCase().startsWith('0x') && secret.length === 66) || secret.length === 64) return AccountType.privkey;

    // try {
    //   if (JSON.parse(this.tmpSecret)) return AccountType.keystore;
    // } catch (error) {}

    return undefined;
  }

  private getCorePassword(userPassword: string) {
    const salt = Cipher.decrypt(Buffer.from(this.key.saltIv, 'hex'), this.key.salt, userPassword);
    return `${salt}-${userPassword}`;
  }
}

export default new WalletKey();
