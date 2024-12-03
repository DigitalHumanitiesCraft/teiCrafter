import React from 'react';
import { IonContent, IonPage } from '@ionic/react';
import './SplashScreen.css';

const SplashScreen: React.FC = () => {
  return (
    <IonPage>
      <IonContent className="splash-container" fullscreen>
        <div className="splash-content">
          <img 
            src="/assets/logo.png" 
            alt="TEICrafter Logo" 
            className="splash-logo"
          />
          <h1 className="splash-title">TEICrafter</h1>
          <h2 className="company-name">by Digital Humanities Craft</h2>
        </div>
      </IonContent>
    </IonPage>
  );
};

export default SplashScreen;