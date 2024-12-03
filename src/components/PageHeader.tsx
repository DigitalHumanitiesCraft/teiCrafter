import {
    IonHeader,
    IonToolbar,
    IonTitle,
    IonButtons,
    IonBackButton
  } from '@ionic/react';
  import './PageHeader.css';
  
  interface PageHeaderProps {
    title?: string;
    showBackButton?: boolean;
    defaultBackHref?: string;
  }
  
  const PageHeader: React.FC<PageHeaderProps> = ({ 
    title, 
    showBackButton = false,
    defaultBackHref = '/home'
  }) => {
    return (
      <IonHeader>
        <IonToolbar>
          {showBackButton && (
            <IonButtons slot="start">
              <IonBackButton defaultHref={defaultBackHref} />
            </IonButtons>
          )}
          <div className="header-content">
            <img 
              src="/assets/logo.png" 
              alt="TEICrafter" 
              className="header-logo" 
            />
            {title && <IonTitle>{title}</IonTitle>}
          </div>
        </IonToolbar>
      </IonHeader>
    );
  };
  
  export default PageHeader;