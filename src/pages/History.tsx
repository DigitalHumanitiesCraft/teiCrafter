import { useState, useEffect } from 'react';
import {
  IonContent,
  IonHeader,
  IonPage,
  IonTitle,
  IonToolbar,
  IonList,
  IonItem,
  IonThumbnail,
  IonLabel,
  IonButton,
  IonIcon,
  IonItemSliding,
  IonItemOptions,
  IonItemOption,
  IonRefresher,
  IonRefresherContent,
  IonAlert,
  RefresherEventDetail
} from '@ionic/react';
import { useHistory } from 'react-router-dom';
import { trash, eye, copy } from 'ionicons/icons';
import { StorageService, ConversionHistoryItem } from '../services/storage.service';

const History: React.FC = () => {
  const [historyItems, setHistoryItems] = useState<ConversionHistoryItem[]>([]);
  const [showDeleteAlert, setShowDeleteAlert] = useState(false);
  const history = useHistory();

  const loadHistory = async () => {
    const items = await StorageService.getHistory();
    setHistoryItems(items);
  };

  useEffect(() => {
    loadHistory();
  }, []);

  const handleRefresh = async (event: CustomEvent<RefresherEventDetail>) => {
    await loadHistory();
    event.detail.complete();
  };

  const handleView = (item: ConversionHistoryItem) => {
    history.push('/xml/view', { xml: item.teiXml });
  };

  const handleDelete = async (id: string) => {
    await StorageService.deleteHistoryItem(id);
    await loadHistory();
  };

  const handleClearAll = async () => {
    await StorageService.clearHistory();
    await loadHistory();
    setShowDeleteAlert(false);
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString();
  };

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>History</IonTitle>
          {historyItems.length > 0 && (
            <IonButton
              slot="end"
              fill="clear"
              onClick={() => setShowDeleteAlert(true)}
            >
              <IonIcon slot="icon-only" icon={trash} />
            </IonButton>
          )}
        </IonToolbar>
      </IonHeader>

      <IonContent>
        <IonRefresher slot="fixed" onIonRefresh={handleRefresh}>
          <IonRefresherContent></IonRefresherContent>
        </IonRefresher>

        {historyItems.length === 0 ? (
          <div className="ion-padding ion-text-center">
            <p>No conversions yet</p>
          </div>
        ) : (
          <IonList>
            {historyItems.map((item) => (
              <IonItemSliding key={item.id}>
                <IonItem button onClick={() => handleView(item)}>
                  <IonThumbnail slot="start">
                    <img
                      src={item.imageDataUrl}
                      alt="Converted"
                      style={{
                        objectFit: 'cover',
                        width: '100%',
                        height: '100%'
                      }}
                    />
                  </IonThumbnail>
                  <IonLabel>
                    <h2>Conversion {item.id}</h2>
                    <p>{formatDate(item.timestamp)}</p>
                  </IonLabel>
                  <IonIcon slot="end" icon={eye} />
                </IonItem>

                <IonItemOptions side="end">
                  <IonItemOption
                    color="danger"
                    onClick={() => handleDelete(item.id)}
                    expandable
                  >
                    <IonIcon slot="icon-only" icon={trash} />
                  </IonItemOption>
                </IonItemOptions>
              </IonItemSliding>
            ))}
          </IonList>
        )}

        <IonAlert
          isOpen={showDeleteAlert}
          onDidDismiss={() => setShowDeleteAlert(false)}
          header="Clear History"
          message="Are you sure you want to clear all conversion history?"
          buttons={[
            {
              text: 'Cancel',
              role: 'cancel'
            },
            {
              text: 'Clear',
              role: 'destructive',
              handler: handleClearAll
            }
          ]}
        />
      </IonContent>
    </IonPage>
  );
};

export default History;