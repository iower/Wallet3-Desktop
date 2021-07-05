import './Settings.css';

import { Menu, MenuButton, MenuDivider, MenuItem } from '@szhsin/react-menu';

import { Application } from '../../viewmodels/Application';
import { CurrencyVM } from '../../viewmodels/settings/CurrencyVM';
import DisplayCurrency from './components/DisplayCurrency';
import Feather from 'feather-icons-react';
import { LangsVM } from '../../viewmodels/settings/LangsVM';
import { NetworksVM } from '../../viewmodels/NetworksVM';
import React from 'react';
import Select from 'react-select';
import { WalletVM } from '../../viewmodels/WalletVM';
import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';

interface IConstructor {
  app: Application;
  langsVM: LangsVM;
}

const MenuItemStyle = {
  padding: 0,
  fontSize: 12,
};

export default observer(({ app, langsVM }: IConstructor) => {
  const { t } = useTranslation();
  const { currentWallet, currencyVM } = app;

  const accounts = currentWallet.accounts.map((a, i) => {
    const addr = `${a.address.substring(0, 7)}...${a.address.substring(a.address.length - 4)}`;
    const balance = a.nativeToken ? `(${a.nativeToken.amount.toFixed(2)} ${a.nativeToken.symbol})` : '';
    const name = a.name || (a.ens ? a.ens.substring(0, a.ens.indexOf('.eth')).substring(0, 12) : `Account ${i + 1}`);
    return {
      label: `${name} | ${addr} ${balance}`,
      value: a,
    };
  });

  const goToBackupMnemonic = async () => {
    const { success, authKey } = await app.auth();
    if (!success) return;

    app.history.push(`/backupMnemonic/${authKey}`);
  };

  const goToChangePasscode = async () => {
    const { success, authKey } = await app.auth();
    if (!success) return;

    app.history.push(`/setupPassword/${authKey}`);
  };

  const goToReset = async () => {
    const { success, authKey } = await app.auth();
    if (!success) return;

    app.history.push(`/reset/${authKey}`);
  };

  const iconSize = 15;
  return (
    <div className="page settings">
      <div className="drop-menu accounts">
        <div className="actions">
          <span className="title">{t('Accounts')}</span>

          <span></span>

          <Menu
            styles={{ minWidth: '3rem' }}
            menuButton={() => (
              <MenuButton className="menu-button">
                <span>Wallet 1</span>
              </MenuButton>
            )}
          >
            {app.wallets.map((k) => {
              return (
                <MenuItem styles={MenuItemStyle} key={k.id}>
                  <button>
                    <div className={`${currentWallet.id === k.id ? 'active' : ''}`}>
                      <Feather icon="credit-card" size={13} />
                      <span>{k.name}</span>
                    </div>
                  </button>
                </MenuItem>
              );
            })}
            <MenuDivider />
            <MenuItem styles={MenuItemStyle}>
              <button onClick={(_) => app.history.push('/generate?')}>
                <div>
                  <Feather icon="plus-square" size={13} />
                  <span>{t('New')}</span>
                </div>
              </button>
            </MenuItem>
            <MenuItem styles={MenuItemStyle}>
              <button onClick={(_) => app.history.push('/import')}>
                <div>
                  <Feather icon="chevrons-down" size={13} />
                  <span>{t('Import')}</span>
                </div>
              </button>
            </MenuItem>
          </Menu>
        </div>
        <Select
          options={accounts}
          isClearable={false}
          isSearchable={false}
          defaultValue={accounts.find((a) => a.value.address === currentWallet.currentAccount.address)}
          onChange={(v) => currentWallet.selectAccount(v.value)}
        />
      </div>

      <div className="setting-item">
        <Feather icon="dollar-sign" size={iconSize} />
        <span>{t('Display Currency')}</span>
        <Menu
          styles={{ minWidth: '3rem' }}
          menuButton={() => (
            <MenuButton className="menu-button">
              <DisplayCurrency flag={currencyVM.currentCurrency.flag} label={currencyVM.currentCurrency.currency} />
            </MenuButton>
          )}
        >
          {currencyVM.supportedCurrencies.map((c) => {
            return (
              <MenuItem key={c.flag} styles={MenuItemStyle}>
                <button onClick={() => currencyVM.setCurrency(c)}>
                  <DisplayCurrency flag={c.flag} label={c.currency} mini />
                </button>
              </MenuItem>
            );
          })}
        </Menu>
      </div>

      <div className="setting-item">
        <Feather icon="globe" size={iconSize} />
        <span>{t('Languages')}</span>

        <Menu
          styles={{ minWidth: '5rem' }}
          menuButton={() => (
            <MenuButton className="menu-button">
              <DisplayCurrency flag={langsVM.currentLang.flag} label={langsVM.currentLang.name} />
            </MenuButton>
          )}
        >
          {langsVM.supportedLangs.map((lang) => {
            return (
              <MenuItem key={lang.value} styles={MenuItemStyle}>
                <button onClick={(_) => langsVM.setLang(lang)}>
                  <DisplayCurrency flag={lang.flag} label={lang.name} mini />
                </button>
              </MenuItem>
            );
          })}
        </Menu>
      </div>

      <div className="setting-item click" onClick={(_) => goToBackupMnemonic()}>
        <Feather icon="package" size={iconSize} />
        <span>{t('Backup Wallet')}</span>
        <Feather icon="chevron-right" size={15} />
      </div>

      <div className="setting-item click" onClick={(_) => goToChangePasscode()}>
        <Feather icon="lock" size={iconSize} />
        <span>{t('Change Passcode')}</span>
        <Feather icon="chevron-right" size={15} />
      </div>

      <div className="setting-item click" onClick={(_) => goToReset()}>
        <Feather icon="tool" size={iconSize} />
        <span>{t('Reset')}</span>
        <Feather icon="chevron-right" size={15} />
      </div>

      <div className="setting-item click" onClick={(_) => app.history.push(`/about`)}>
        <Feather icon="book" size={iconSize} />
        <span>{t('About')}</span>
        <Feather icon="chevron-right" size={15} />
      </div>
    </div>
  );
});
