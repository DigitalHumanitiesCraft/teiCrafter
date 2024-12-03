import React, { useState } from 'react';
import {
  IonContent,
  IonHeader,
  IonPage,
  IonTitle,
  IonToolbar,
  IonButtons,
  IonBackButton,
  IonCard,
  IonCardContent,
  IonButton,
  IonIcon,
  IonActionSheet,
  IonToast
} from '@ionic/react';
import { useLocation } from 'react-router';
import {
  copy,
  share,
  mailOutline,
  logoGoogle,
  ellipsisVertical
} from 'ionicons/icons';
import { Share } from '@capacitor/share';
import './XMLViewer.css';

interface LocationState {
  xml: string;
}

const XMLViewer: React.FC = () => {
  const location = useLocation<LocationState>();
  const xml = location.state?.xml || 'No XML content available';
  const [showActions, setShowActions] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(xml);
      setToastMessage('Copied to clipboard');
      setShowToast(true);
    } catch (err) {
      console.error('Failed to copy:', err);
      setToastMessage('Failed to copy');
      setShowToast(true);
    }
  };

  const handleShare = async () => {
    try {
      await Share.share({
        title: 'TEI/XML Document',
        text: xml,
        dialogTitle: 'Share TEI/XML'
      });
    } catch (error) {
      console.error('Failed to share:', error);
      setToastMessage('Failed to share');
      setShowToast(true);
    }
  };

  const handleEmail = async () => {
    const subject = encodeURIComponent('TEI/XML Document');
    const body = encodeURIComponent(xml);
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
  };

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start">
            <IonBackButton defaultHref="/history" />
          </IonButtons>
          <IonTitle>TEI/XML Result</IonTitle>
          <IonButtons slot="end">
            <IonButton onClick={() => setShowActions(true)}>
              <IonIcon slot="icon-only" icon={ellipsisVertical} />
            </IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>

      <IonContent>
        <IonCard>
          <IonCardContent>
            <pre className="xml-content">
              {xml}
            </pre>
          </IonCardContent>
        </IonCard>

        <IonActionSheet
          isOpen={showActions}
          onDidDismiss={() => setShowActions(false)}
          buttons={[
            {
              text: 'Copy to Clipboard',
              icon: copy,
              handler: handleCopy
            },
            {
              text: 'Share',
              icon: share,
              handler: handleShare
            },
            {
              text: 'Send via Email',
              icon: mailOutline,
              handler: handleEmail
            },
            {
              text: 'Cancel',
              role: 'cancel'
            }
          ]}
        />

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

export default XMLViewer;