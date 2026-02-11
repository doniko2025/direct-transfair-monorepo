// apps/direct-transfair-mobile/app/[tenant]/index.tsx
import { useEffect } from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { api } from '../../services/api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors } from '../../theme/colors';

export default function TenantRedirectScreen() {
  const { tenant } = useLocalSearchParams();
  const router = useRouter();

  useEffect(() => {
    const configureTenant = async () => {
      if (tenant && typeof tenant === 'string') {
        const companyCode = tenant.toUpperCase();
        
        console.log(`🏢 Configuration de la société : ${companyCode}`);

        // 1. Sauvegarder le code société pour toujours
        await AsyncStorage.setItem('PREFERRED_TENANT', companyCode);

        // 2. Configurer l'API immédiatement
        api.setTenant(companyCode);

        // 3. Simuler un petit délai pour que l'utilisateur voie qu'il se passe quelque chose
        setTimeout(() => {
           // On remplace la route pour empêcher le "Retour arrière"
           router.replace('/(auth)/login');
        }, 1000);
        
      } else {
        // Si l'URL est bizarre, on renvoie au login standard
        router.replace('/(auth)/login');
      }
    };

    configureTenant();
  }, [tenant, router]);

  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.primary }}>
      <ActivityIndicator size="large" color="#FFFFFF" />
      <Text style={{ marginTop: 20, color: '#FFF', fontWeight: 'bold', fontSize: 18 }}>
        Connexion à l'espace {typeof tenant === 'string' ? tenant.toUpperCase() : '...'}
      </Text>
    </View>
  );
}