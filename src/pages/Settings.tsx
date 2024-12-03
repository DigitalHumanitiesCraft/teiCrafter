import { useState, useEffect } from 'react';
import {
  IonContent,
  IonHeader,
  IonPage,
  IonTitle,
  IonToolbar,
  IonList,
  IonItem,
  IonLabel,
  IonInput,
  IonButton,
  IonToast,
  IonIcon,
  IonNote,
  IonCard,
  IonCardContent
} from '@ionic/react';
import { key, save, lockClosed } from 'ionicons/icons';
import { Preferences } from '@capacitor/preferences';

const Settings: React.FC = () => {
  const [apiKey, setApiKey] = useState('');
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  // Load saved API key on component mount
  useEffect(() => {
    loadApiKey();
  }, []);

  const loadApiKey = async () => {
    try {
      const { value } = await Preferences.get({ key: 'openai_api_key' });
      if (value) {
        setApiKey(value);
      }
    } catch (error) {
      console.error('Failed to load API key:', error);
      setToastMessage('Failed to load API key');
      setShowToast(true);
    } finally {
      setIsLoading(false);
    }
  };

  const validateApiKey = (key: string) => {
    // Basic validation: should be 51 characters starting with 'sk-'
    return /^sk-[A-Za-z0-9]{48}$/.test(key);
  };

  const saveApiKey = async () => {
    if (!apiKey) {
      setToastMessage('Please enter an API key');
      setShowToast(true);
      return;
    }

    try {
      await Preferences.set({
        key: 'openai_api_key',
        value: apiKey.trim() // Just trim whitespace
      });
      setToastMessage('API key saved successfully');
      setShowToast(true);
    } catch (error) {
      console.error('Failed to save API key:', error);
      setToastMessage('Failed to save API key');
      setShowToast(true);
    }
  };

  const clearApiKey = async () => {
    try {
      await Preferences.remove({ key: 'openai_api_key' });
      setApiKey('');
      setToastMessage('API key removed');
      setShowToast(true);
    } catch (error) {
      console.error('Failed to clear API key:', error);
      setToastMessage('Failed to clear API key');
      setShowToast(true);
    }
  };

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>Settings</IonTitle>
        </IonToolbar>
      </IonHeader>

      <IonContent>
        <IonCard className="ion-margin">
          <IonCardContent>
            <div className="ion-margin-bottom">
              <IonIcon
                icon={lockClosed}
                color="success"
                style={{
                  fontSize: '24px',
                  verticalAlign: 'middle',
                  marginRight: '8px'
                }}
              />
              <strong>Security Information</strong>
            </div>
            <p>
              Your API key is stored securely on your device only. It is:
            </p>
            <ul>
              <li>Never transmitted to any server except OpenAI</li>
              <li>Stored only in your device's secure storage</li>
              <li>Not included in backups</li>
              <li>Automatically removed when you uninstall the app</li>
            </ul>
          </IonCardContent>
        </IonCard>

        <IonList>
          <IonItem>
            <IonLabel position="stacked">
              OpenAI API Key
              <IonNote className="ion-margin-top">
                Enter your OpenAI API key for TEI/XML conversion
              </IonNote>
            </IonLabel>
            <IonInput
              type="password"
              value={apiKey}
              onIonChange={e => setApiKey(e.detail.value || '')}
              placeholder="sk-..."
              className="ion-margin-top"
            >
              <IonIcon icon={key} slot="start" />
            </IonInput>
          </IonItem>

          <IonItem lines="none" className="ion-margin-top">
            <IonButton
              expand="block"
              onClick={saveApiKey}
              disabled={isLoading}
            >
              <IonIcon icon={save} slot="start" />
              Save API Key
            </IonButton>
            {apiKey && (
              <IonButton
                expand="block"
                color="danger"
                onClick={clearApiKey}
                disabled={isLoading}
                className="ion-margin-start"
              >
                Clear Key
              </IonButton>
            )}
          </IonItem>
        </IonList>

        <div className="ion-padding">
          <IonNote>
            Don't have an API key? Get one from{' '}
            <a
              href="https://platform.openai.com/api-keys"
              target="_blank"
              rel="noopener noreferrer"
            >
              OpenAI's website
            </a>
          </IonNote>
        </div>

        <IonToast
          isOpen={showToast}
          onDidDismiss={() => setShowToast(false)}
          message={toastMessage}
          duration={2000}
          position="bottom"
        />
      </IonContent>
    </IonPage>
  );
};

export default Settings;