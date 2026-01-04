// apps/direct-transfair-mobile/utils/alert.ts
import { Alert, Platform } from "react-native";

/**
 * showAlert : Fonction universelle compatible Mobile + Web
 * - Sur mobile : Alert.alert()
 * - Sur web : window.alert()
 */
export function showAlert(title: string, message: string) {
  if (Platform.OS === "web") {
    window.alert(`${title}\n${message}`);
  } else {
    Alert.alert(title, message);
  }
}
