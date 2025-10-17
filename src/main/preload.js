const { contextBridge, ipcRenderer } = require('electron');

// Exp�e um objeto 'ipcRenderer' seguro para o processo de renderiza��o (seu React app)
contextBridge.exposeInMainWorld('ipcRenderer', {
  /**
   * Envia uma mensagem para o processo principal e espera por uma resposta.
   * @param {string} channel - O nome do canal/evento.
   * @param {...any} args - Os argumentos para enviar.
   * @returns {Promise<any>} A resposta do processo principal.
   */
  invoke: (channel, ...args) => ipcRenderer.invoke(channel, ...args),

  /**
   * Escuta por um canal vindo do processo principal.
   * @param {string} channel - O nome do canal/evento.
   * @param {Function} listener - A fun��o a ser chamada com os dados recebidos.
   */
  on: (channel, listener) => {
    // Cria um listener seguro que remove o wrapper do evento do Electron
    const safeListener = (event, ...args) => listener(...args);
    ipcRenderer.on(channel, safeListener);

    // Retorna uma fun��o para remover o listener, �til para limpeza em componentes React
    return () => {
      ipcRenderer.removeListener(channel, safeListener);
    };
  },

  /**
   * Remove todos os listeners de um canal espec�fico.
   * @param {string} channel - O nome do canal/evento.
   */
  removeAllListeners: (channel) => ipcRenderer.removeAllListeners(channel),
});