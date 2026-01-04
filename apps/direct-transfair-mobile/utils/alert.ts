// apps/direct-transfair-mobile/utils/alert.ts
import { Alert, Platform } from "react-native";

/**
 * Affiche une alerte simple (Info, Succès, Erreur)
 * @param title Titre de l'alerte
 * @param message Message
 * @param onOk (Optionnel) Fonction à exécuter quand l'utilisateur clique sur OK
 */
export function showAlert(title: string, message: string, onOk?: () => void) {
  if (Platform.OS === "web") {
    // Le setTimeout permet à React de rafraîchir l'UI (enlever le loader) avant de bloquer avec l'alerte
    setTimeout(() => {
      window.alert(`${title}\n\n${message}`);
      if (onOk) onOk();
    }, 100);
  } else {
    Alert.alert(title, message, [
      { text: "OK", onPress: onOk }
    ]);
  }
}

/**
 * Demande une confirmation (Oui/Non)
 * @param title Titre
 * @param message Question
 * @param onConfirm Fonction à exécuter si l'utilisateur dit OUI
 */
export function showConfirm(title: string, message: string, onConfirm: () => void) {
  if (Platform.OS === "web") {
    setTimeout(() => {
      const ok = window.confirm(`${title}\n\n${message}`);
      if (ok) {
        onConfirm();
      }
    }, 100);
  } else {
    Alert.alert(title, message, [
      { text: "Annuler", style: "cancel" },
      { 
        text: "Confirmer", 
        style: "destructive", 
        onPress: onConfirm 
      },
    ]);
  }
}