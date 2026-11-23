import { Download } from 'lucide-react';
import { useEffect, useState } from 'react';

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
};

export default function PwaInstallButton() {
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    const standaloneNavigator = navigator as Navigator & { standalone?: boolean };
    const syncInstalledState = () => {
      setInstalled(
        window.matchMedia('(display-mode: standalone)').matches
          || standaloneNavigator.standalone === true,
      );
    };
    const handleInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as InstallPromptEvent);
    };
    const handleInstalled = () => {
      setInstalled(true);
      setInstallPrompt(null);
      setMessage('');
    };

    syncInstalledState();
    window.addEventListener('beforeinstallprompt', handleInstallPrompt);
    window.addEventListener('appinstalled', handleInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', handleInstallPrompt);
      window.removeEventListener('appinstalled', handleInstalled);
    };
  }, []);

  const install = async () => {
    if (installed) return;
    if (!installPrompt) {
      setMessage('Open the browser menu and choose Install app or Add to Home Screen.');
      return;
    }

    const prompt = installPrompt;
    setInstallPrompt(null);
    try {
      await prompt.prompt();
      const choice = await prompt.userChoice;
      if (choice.outcome === 'accepted') {
        setInstalled(true);
        setMessage('');
      } else {
        setMessage('Installation was canceled. You can try again from the browser menu.');
      }
    } catch (error) {
      console.error('The app installation prompt failed.', error);
      setMessage('The install prompt could not open. Use the browser menu to install the app.');
    }
  };

  return (
    <div>
      <button className="setting-action" type="button" onClick={() => void install()} disabled={installed}>
        <Download size={17} />
        <span>{installed ? 'App installed' : 'Install this app'}</span>
      </button>
      {message && <p className="pwa-install-message" role="status">{message}</p>}
    </div>
  );
}
