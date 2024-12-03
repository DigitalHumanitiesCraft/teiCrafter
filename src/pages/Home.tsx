import { useState } from 'react';
import {
  IonContent,
  IonHeader,
  IonPage,
  IonTitle,
  IonToolbar,
  IonButton,
  IonIcon,
  IonCard,
  IonCardContent,
  IonText,
  IonToast,
  IonLoading,
} from '@ionic/react';
import { useHistory } from 'react-router-dom';
import { camera, image, document } from 'ionicons/icons';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { ApiService } from '../services/api.service';
import { StorageService } from '../services/storage.service';
import PageHeader from '../components/PageHeader';
import './Home.css';

const Home: React.FC = () => {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [converting, setConverting] = useState(false);
  const history = useHistory();

  const handleCapture = async () => {
    try {
      const image = await Camera.getPhoto({
        quality: 90,
        allowEditing: true,
        resultType: CameraResultType.DataUrl,
        source: CameraSource.Camera
      });

      setSelectedImage(image.dataUrl || null);
    } catch (error) {
      console.error('Camera error:', error);
      setToastMessage('Failed to capture image');
      setShowToast(true);
    }
  };

  const handleGallery = async () => {
    try {
      const image = await Camera.getPhoto({
        quality: 90,
        allowEditing: true,
        resultType: CameraResultType.DataUrl,
        source: CameraSource.Photos
      });

      setSelectedImage(image.dataUrl || null);
    } catch (error) {
      console.error('Gallery error:', error);
      setToastMessage('Failed to select image');
      setShowToast(true);
    }
  };

  const handleConvert = async () => {
    if (!selectedImage) {
      setToastMessage('Please select an image first');
      setShowToast(true);
      return;
    }

    setConverting(true);
    try {
      const result = await ApiService.convertImageToTEI(selectedImage);

      if (result.success && result.teiXml) {
        // Save to history
        await StorageService.saveConversion(selectedImage, result.teiXml);

        setToastMessage('Conversion successful!');
        setShowToast(true);

        // Navigate using history
        history.push('/xml/view', { xml: result.teiXml });
      } else {
        throw new Error(result.error || 'Conversion failed');
      }
    } catch (error) {
      console.error('Conversion error:', error);
      setToastMessage(error instanceof Error ? error.message : 'Conversion failed');
      setShowToast(true);
    } finally {
      setConverting(false);
    }
  };

  return (
    <IonPage>
      <PageHeader title="teiCrafter" />
      <IonContent className="page-container">
        <img
          src="/assets/logo.png"
          alt=""
          className="background-logo"
          aria-hidden="true"
        />

        <div className="content-container">
          <IonCard>
            <IonCardContent className="image-container">
              {selectedImage ? (
                <img
                  src={selectedImage}
                  alt="Selected"
                  style={{ maxWidth: '100%', maxHeight: '300px' }}
                />
              ) : (
                <IonText color="medium" className="no-image-text">
                  <h2>No Image Selected</h2>
                  <p>Take a photo or choose from gallery</p>
                </IonText>
              )}
            </IonCardContent>
          </IonCard>

          <div className="button-container">
            <IonButton
              expand="block"
              onClick={handleCapture}
              disabled={converting}
            >
              <IonIcon slot="start" icon={camera} />
              TAKE PHOTO
            </IonButton>

            <IonButton
              expand="block"
              onClick={handleGallery}
              color="secondary"
              className="ion-margin-top"
              disabled={converting}
            >
              <IonIcon slot="start" icon={image} />
              CHOOSE FROM GALLERY
            </IonButton>

            {selectedImage && (
              <IonButton
                expand="block"
                onClick={handleConvert}
                color="tertiary"
                className="ion-margin-top"
                disabled={converting}
              >
                <IonIcon slot="start" icon={document} />
                CONVERT TO TEI/XML
              </IonButton>
            )}
          </div>
        </div>

        <IonToast
          isOpen={showToast}
          onDidDismiss={() => setShowToast(false)}
          message={toastMessage}
          duration={2000}
          position="bottom"
        />

        <IonLoading
          isOpen={converting}
          message="Converting image to TEI/XML..."
        />
      </IonContent>
    </IonPage>
  );
};

export default Home;