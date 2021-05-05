import Messages, { ConfirmSendTx, InitStatus, PopupWindowTypes } from '../../common/Messages';

import { Application } from './Application';
import { ConfirmVM } from './ConfirmVM';
import { ConnectDappVM } from './ConnectDappVM';
import { createBrowserHistory } from 'history';
import ipc from '../bridges/IPC';

export class ApplicationPopup extends Application {
  readonly history = createBrowserHistory();
  type: PopupWindowTypes;

  async init() {
    super.init(false);

    ipc.once(Messages.initWindowType, (e, { type, payload }: { type: PopupWindowTypes; payload }) => {
      this.type = type;

      switch (this.type) {
        case 'sendTx':
          this.confirmVM = new ConfirmVM(payload as ConfirmSendTx);
          this.history.push('/sendTx');
          break;
        case 'scanQR':
          this.history.push('/scanQR');
          break;
        case 'connectDapp':
          this.connectDappVM = new ConnectDappVM(payload);
          this.history.push('/connectDapp');
          break;
      }
    });
  }

  confirmVM: ConfirmVM;
  connectDappVM: ConnectDappVM;
}

export default new ApplicationPopup();
