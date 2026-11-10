// apps/direct-transfair-mobile/components/receipt/ReceiptScannerModal.tsx
// =========================================================
// SCANNER DE REÇU (agent) — la caméra lit le QR du reçu ; le contenu brut est renvoyé à l'écran, qui l'envoie tel quel à la vérification
// puis au paiement (le serveur contrôle la signature). Une scanette Bluetooth/USB qui « tape » le QR dans le champ de saisie fait la même chose.
// =========================================================

import React, { useEffect, useRef } from "react";
import { Modal, Pressable, StatusBar, StyleSheet, Text, View } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { Ionicons } from "../ui/Icon";

export function ReceiptScannerModal({ visible, onClose, onScanned }: { visible: boolean; onClose: () => void; onScanned: (raw: string) => void }) {
  const [permission, requestPermission] = useCameraPermissions();
  const lock = useRef(false);

  useEffect(() => {
    if (visible) {
      lock.current = false;
      if (permission && !permission.granted && permission.canAskAgain) void requestPermission();
    }
  }, [visible, permission, requestPermission]);

  const handle = ({ data }: { data: string }) => {
    if (lock.current || !data) return;
    lock.current = true;
    onScanned(String(data));
  };

  const corner = (pos: object) => <View style={[{ position: "absolute", width: 42, height: 42, borderColor: "#FFFFFF" }, pos]} />;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View style={{ flex: 1, backgroundColor: "#000" }}>
        <StatusBar barStyle="light-content" />
        {permission?.granted ? (
          <CameraView style={StyleSheet.absoluteFill} facing="back" barcodeScannerSettings={{ barcodeTypes: ["qr", "code128", "ean13", "code39"] }} onBarcodeScanned={handle} />
        ) : (
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 32, gap: 14 }}>
            <Ionicons name="camera-outline" size={44} color="#FFFFFF" />
            <Text style={{ color: "#FFFFFF", fontSize: 17, fontWeight: "700", textAlign: "center" }}>Accès à la caméra requis</Text>
            <Text style={{ color: "rgba(255,255,255,0.75)", textAlign: "center" }}>La caméra sert uniquement à lire le QR code du reçu. Vous pouvez aussi saisir le code ou utiliser une scanette.</Text>
            {permission?.canAskAgain !== false && (
              <Pressable onPress={requestPermission} style={{ backgroundColor: "#FFFFFF", paddingHorizontal: 22, paddingVertical: 12, borderRadius: 99 }}>
                <Text style={{ fontWeight: "800" }}>Autoriser la caméra</Text>
              </Pressable>
            )}
          </View>
        )}
        {permission?.granted && (
          <View pointerEvents="none" style={[StyleSheet.absoluteFill, { alignItems: "center", justifyContent: "center" }]}>
            <View style={{ width: 250, height: 250 }}>
              {corner({ top: 0, left: 0, borderTopWidth: 5, borderLeftWidth: 5, borderTopLeftRadius: 18 })}
              {corner({ top: 0, right: 0, borderTopWidth: 5, borderRightWidth: 5, borderTopRightRadius: 18 })}
              {corner({ bottom: 0, left: 0, borderBottomWidth: 5, borderLeftWidth: 5, borderBottomLeftRadius: 18 })}
              {corner({ bottom: 0, right: 0, borderBottomWidth: 5, borderRightWidth: 5, borderBottomRightRadius: 18 })}
            </View>
            <Text style={{ color: "#FFFFFF", marginTop: 22, fontWeight: "700", textAlign: "center", paddingHorizontal: 30 }}>Cadrez le QR code du reçu du client</Text>
          </View>
        )}
        <Pressable onPress={onClose} accessibilityLabel="Fermer" hitSlop={12} style={{ position: "absolute", top: 48, right: 20, width: 42, height: 42, borderRadius: 21, backgroundColor: "rgba(0,0,0,0.55)", alignItems: "center", justifyContent: "center" }}>
          <Ionicons name="close" size={22} color="#FFFFFF" />
        </Pressable>
      </View>
    </Modal>
  );
}
