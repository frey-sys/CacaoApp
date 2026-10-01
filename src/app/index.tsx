import {
  api,
  ApiResponseError,
  type Finca,
  type RegistroCalidad,
  type Ruta,
} from '@/services/api';
import { clearSession, loadSession, saveSession } from '@/services/sessionStore';
import { UrbanMap } from '@/components/urban-map';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

type Screen =
  | 'login'
  | 'register'
  | 'home'
  | 'fincas'
  | 'mapa'
  | 'rutas'
  | 'calidad';

/* ============================================================
   ICONOS NATIVOS
   ============================================================ */

function IconLeaf({ size = 24 }: { size?: number }) {
  return <Text style={{ fontSize: size }}>🌿</Text>;
}

function IconPin({ size = 24 }: { size?: number }) {
  return <Text style={{ fontSize: size }}>📍</Text>;
}

function IconRoad({ size = 28 }: { size?: number }) {
  return <Text style={{ fontSize: size }}>🛣️</Text>;
}

function IconGrain({ size = 28 }: { size?: number }) {
  return <Text style={{ fontSize: size }}>🍫</Text>;
}

function IconGear({ size = 22 }: { size?: number }) {
  return <Text style={{ fontSize: size }}>⚙️</Text>;
}

function IconTrash({ size = 20 }: { size?: number }) {
  return <Text style={{ fontSize: size }}>🗑️</Text>;
}

function IconCheck({ size = 18 }: { size?: number }) {
  return <Text style={{ fontSize: size }}>✅</Text>;
}

function IconSave({ size = 20 }: { size?: number }) {
  return <Text style={{ fontSize: size }}>💾</Text>;
}

function IconEye({
  size = 20,
  open = true,
}: {
  size?: number;
  open?: boolean;
}) {
  return <Text style={{ fontSize: size }}>{open ? '👁️' : '🙈'}</Text>;
}

/* ============================================================
   COMPONENTES AUXILIARES
   ============================================================ */

function Header({
  title,
  back,
  setScreen,
  onLogout,
}: {
  title: string;
  back?: Screen;
  setScreen: React.Dispatch<React.SetStateAction<Screen>>;
  onLogout?: () => void;
}) {
  return (
    <View style={styles.header}>
      <View style={styles.headerLeft}>
        {back && (
          <Pressable
            onPress={() => setScreen(back)}
            style={styles.backButton}
          >
            <Text style={styles.backText}>‹</Text>
          </Pressable>
        )}

        <Text style={styles.headerTitle}>{title}</Text>
      </View>

      {onLogout ? (
        <Pressable
          onPress={onLogout}
          style={styles.logoutButton}
          accessibilityRole="button"
          accessibilityLabel="Cerrar sesión"
        >
          <Text style={styles.logoutButtonText}>Salir</Text>
        </Pressable>
      ) : (
        <Pressable style={styles.gearButton}>
          <IconGear size={20} />
        </Pressable>
      )}
    </View>
  );
}

function RequisitoCard({
  tipo,
  items,
}: {
  tipo: 'funcional' | 'no_funcional';
  items: string[];
}) {
  const [open, setOpen] = useState(false);
  const funcional = tipo === 'funcional';

  return (
    <View
      style={[
        styles.requirementCard,
        {
          borderColor: funcional ? COLORS.green : COLORS.blue,
        },
      ]}
    >
      <Pressable
        onPress={() => setOpen(!open)}
        style={[
          styles.requirementHeader,
          {
            backgroundColor: funcional ? '#F0F8EE' : '#E8F0FB',
          },
        ]}
      >
        <Text
          style={[
            styles.requirementTitle,
            {
              color: funcional ? COLORS.darkGreen : COLORS.blue,
            },
          ]}
        >
          {funcional
            ? '✅ Requisitos Funcionales (RF)'
            : '🔷 Requisitos No Funcionales (RNF)'}
        </Text>

        <Text style={styles.arrow}>{open ? '▲' : '▼'}</Text>
      </Pressable>

      {open && (
        <View style={styles.requirementBody}>
          {items.map((item, index) => (
            <View key={index} style={styles.requirementRow}>
              <Text style={styles.bullet}>
                {funcional ? '•' : '◆'}
              </Text>

              <Text style={styles.requirementText}>{item}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

function EstadoFermentacion({
  estado,
}: {
  estado: RegistroCalidad['estado'];
}) {
  const data = {
    bien_fermentado: {
      label: 'Bien fermentado',
      bg: '#DCFCE7',
      text: '#166534',
      dot: '#22C55E',
    },
    parcial: {
      label: 'Parcialmente fermentado',
      bg: '#FEF3C7',
      text: '#92400E',
      dot: '#EAB308',
    },
    sin_fermentar: {
      label: 'Sin fermentar',
      bg: '#FEE2E2',
      text: '#991B1B',
      dot: '#EF4444',
    },
  };

  const item = data[estado];

  return (
    <View
      style={[
        styles.statusBadge,
        { backgroundColor: item.bg },
      ]}
    >
      <View
        style={[
          styles.statusDot,
          { backgroundColor: item.dot },
        ]}
      />

      <Text
        style={[
          styles.statusText,
          { color: item.text },
        ]}
      >
        {item.label}
      </Text>
    </View>
  );
}

/* ============================================================
   APLICACIÓN
   ============================================================ */

const COLORS = {
  green: '#2D7A1F',
  darkGreen: '#1A5E1A',
  lightGreen: '#F0F8EE',
  blue: '#1565C0',
  brown: '#6D4C41',
  darkBrown: '#4E342E',
  red: '#8B1A1A',
  gray: '#666666',
  lightGray: '#F5F5F5',
  border: '#E0E0E0',
};

export default function App() {
  const [screen, setScreen] = useState<Screen>('login');
  const [restoringSession, setRestoringSession] = useState(true);

  const [authToken, setAuthToken] = useState<string | null>(null);

  const [fincas, setFincas] = useState<Finca[]>([]);

  const [rutas, setRutas] = useState<Ruta[]>([]);

  const [registrosCalidad, setRegistrosCalidad] =
    useState<RegistroCalidad[]>([]);

  /* LOGIN */

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState('');

  /* REGISTRO */

  const [regNombre, setRegNombre] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regTelefono, setRegTelefono] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirm, setRegConfirm] = useState('');
  const [regMunicipio, setRegMunicipio] = useState('');
  const [showRegPass, setShowRegPass] = useState(false);
  const [regLoading, setRegLoading] = useState(false);
  const [regSuccess, setRegSuccess] = useState(false);
  const [regError, setRegError] = useState('');

  /* FINCAS */

  const [nuevaFinca, setNuevaFinca] = useState('');
  const [obteniendo, setObteniendo] = useState(false);
  const [guardandoFinca, setGuardandoFinca] = useState(false);

  const [coordActual, setCoordActual] = useState<{
    lat: number;
    lng: number;
  } | null>(null);

  /* RUTAS */

  const [fincaSelRuta, setFincaSelRuta] =
    useState<Finca | null>(null);

  const [nombreRuta, setNombreRuta] = useState('');
  const [grabandoRuta, setGrabandoRuta] = useState(false);
  const [puntosGPS, setPuntosGPS] = useState(0);
  const [guardandoRuta, setGuardandoRuta] = useState(false);

  /* CALIDAD */

  const [calFinca, setCalFinca] = useState('');
  const [calHumedad, setCalHumedad] = useState('');
  const [calFermentacion, setCalFermentacion] = useState('');
  const [calTemperatura, setCalTemperatura] = useState('');
  const [calObs, setCalObs] = useState('');

  const [calEstado, setCalEstado] =
    useState<RegistroCalidad['estado']>(
      'bien_fermentado',
    );

  const [calSuccess, setCalSuccess] = useState(false);
  const [guardandoCalidad, setGuardandoCalidad] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);

  const cargarDatosServidor = useCallback(async (token: string) => {
    const [fincasServidor, rutasServidor, calidadServidor] = await Promise.all([
      api.fincas(token),
      api.rutas(token),
      api.calidad(token),
    ]);
    setFincas(fincasServidor);
    setRutas(rutasServidor);
    setRegistrosCalidad(calidadServidor);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const restoreSession = async () => {
      try {
        const session = await loadSession();
        if (!session || cancelled) return;
        await cargarDatosServidor(session.token);
        if (cancelled) return;
        setAuthToken(session.token);
        setScreen('home');
      } catch (error) {
        if (cancelled) return;
        if (error instanceof ApiResponseError && error.status === 401) {
          await clearSession();
          setLoginError('Tu sesión expiró. Inicia sesión de nuevo.');
        } else {
          setLoginError(
            error instanceof Error ? error.message : 'No se pudo conectar con la API.',
          );
        }
      } finally {
        if (!cancelled) setRestoringSession(false);
      }
    };
    void restoreSession().catch((error: unknown) => {
      console.error('No se pudo recuperar la sesión guardada:', error);
    });
    return () => {
      cancelled = true;
    };
  }, [cargarDatosServidor]);

  /* Simulación de puntos GPS */

  useEffect(() => {
    if (!grabandoRuta) return;

    const interval = setInterval(() => {
      setPuntosGPS((p) => p + 1);
    }, 3000);

    return () => clearInterval(interval);
  }, [grabandoRuta]);

  /* ============================================================
     LOGIN
     ============================================================ */

  const handleLogin = async () => {
    if (!email || !password) {
      setLoginError('Completa todos los campos');
      return;
    }

    setLoginError('');
    setLoginLoading(true);

    try {
      const result = await api.login(email.trim(), password);
      const accountEmail = result.usuario.email.toLowerCase();
      await cargarDatosServidor(result.token);
      await saveSession({ email: accountEmail, token: result.token });
      setAuthToken(result.token);
      setScreen('home');
    } catch (error) {
      setLoginError(
        error instanceof Error ? error.message : 'No se pudo iniciar sesión.',
      );
    } finally {
      setLoginLoading(false);
    }
  };

  const handleLogout = () => {
    Alert.alert(
      'Cerrar sesión',
      '¿Quieres cerrar tu sesión en este dispositivo?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Cerrar sesión',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              try {
                await clearSession();
                setAuthToken(null);
                setFincas([]);
                setRutas([]);
                setRegistrosCalidad([]);
                setPassword('');
                setScreen('login');
              } catch (error) {
                Alert.alert(
                  'No se pudo cerrar la sesión',
                  error instanceof Error
                    ? error.message
                    : 'Inténtalo de nuevo.',
                );
              }
            })();
          },
        },
      ],
    );
  };

  /* ============================================================
     REGISTRO
     ============================================================ */

  const handleRegister = async () => {
    if (
      !regNombre ||
      !regEmail ||
      !regPassword ||
      !regConfirm
    ) {
      setRegError(
        'Completa todos los campos obligatorios',
      );
      return;
    }

    if (regPassword !== regConfirm) {
      setRegError('Las contraseñas no coinciden');
      return;
    }

    if (regPassword.length < 6) {
      setRegError(
        'La contraseña debe tener al menos 6 caracteres',
      );
      return;
    }

    setRegError('');
    setRegLoading(true);

    try {
      await api.register({
        nombre: regNombre.trim(),
        email: regEmail.trim(),
        telefono: regTelefono.trim(),
        municipio: regMunicipio,
        password: regPassword,
      });
      setRegSuccess(true);
    } catch (error) {
      setRegError(
        error instanceof Error ? error.message : 'No se pudo crear la cuenta.',
      );
    } finally {
      setRegLoading(false);
    }
  };

  /* ============================================================
     UBICACIÓN SIMULADA
     ============================================================ */

  const handleObtenerUbicacion = () => {
    setObteniendo(true);

    setTimeout(() => {
      const lat =
        7.661 + Math.random() * 0.004;

      const lng =
        -76.684 + Math.random() * 0.004;

      setCoordActual({
        lat: Number(lat.toFixed(6)),
        lng: Number(lng.toFixed(6)),
      });

      setObteniendo(false);
    }, 1500);
  };

  /* ============================================================
     FINCA
     ============================================================ */

  const handleGuardarFinca = async () => {
    if (!nuevaFinca || !coordActual) {
      Alert.alert(
        'Datos incompletos',
        'Escribe el nombre de la finca y obtén su ubicación.',
      );
      return;
    }

    if (!authToken) return;
    setGuardandoFinca(true);
    try {
      const nueva = await api.crearFinca(authToken, {
        nombre: nuevaFinca.trim(),
        lat: coordActual.lat,
        lng: coordActual.lng,
      });
      setFincas((prev) => [nueva, ...prev]);
      setNuevaFinca('');
      setCoordActual(null);
      Alert.alert(
        'Finca guardada',
        'La finca se guardó en el servidor.',
      );
    } catch (error) {
      Alert.alert(
        'No se pudo guardar la finca',
        error instanceof Error ? error.message : 'Inténtalo de nuevo.',
      );
    } finally {
      setGuardandoFinca(false);
    }
  };

  const handleEliminarFinca = (id: number) => {
    Alert.alert(
      'Eliminar finca',
      '¿Deseas eliminar esta finca?',
      [
        {
          text: 'Cancelar',
          style: 'cancel',
        },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            if (!authToken) return;
            try {
              await api.eliminarFinca(authToken, id);
              setFincas((prev) => prev.filter((f) => f.id !== id));
              setRutas((prev) => prev.filter((ruta) => ruta.fincaId !== id));
              setRegistrosCalidad((prev) =>
                prev.filter((registro) => registro.fincaId !== id),
              );
            } catch (error) {
              Alert.alert(
                'No se pudo eliminar la finca',
                error instanceof Error ? error.message : 'Inténtalo de nuevo.',
              );
            }
          },
        },
      ],
    );
  };

  /* ============================================================
     RUTA
     ============================================================ */

  const handleGuardarRuta = async () => {
    if (!fincaSelRuta || !nombreRuta) {
      return;
    }

    if (!authToken) return;
    setGuardandoRuta(true);
    try {
      const nueva = await api.crearRuta(authToken, {
        nombre: nombreRuta.trim(),
        fincaId: fincaSelRuta.id,
        puntos: puntosGPS,
      });
      setRutas((prev) => [nueva, ...prev]);
      setGrabandoRuta(false);
      setPuntosGPS(0);
      setNombreRuta('');
      setFincaSelRuta(null);
      Alert.alert(
        'Ruta guardada',
        'El recorrido se guardó en el servidor.',
      );
    } catch (error) {
      Alert.alert(
        'No se pudo guardar la ruta',
        error instanceof Error ? error.message : 'Inténtalo de nuevo.',
      );
    } finally {
      setGuardandoRuta(false);
    }
  };

  /* ============================================================
     CALIDAD
     ============================================================ */

  const handleGuardarCalidad = async () => {
    if (
      !calFinca ||
      !calHumedad ||
      !calFermentacion
    ) {
      Alert.alert(
        'Datos incompletos',
        'Completa la finca, humedad y fermentación.',
      );
      return;
    }

    if (!authToken) return;
    const finca = fincas.find((item) => item.nombre === calFinca);
    if (!finca) {
      Alert.alert('Finca no disponible', 'Selecciona una finca registrada.');
      return;
    }

    setGuardandoCalidad(true);
    try {
      const nuevo = await api.crearRegistroCalidad(authToken, {
        fincaId: finca.id,
        fecha: new Date().toISOString().slice(0, 10),
        humedad: Number.parseFloat(calHumedad),
        fermentacion: Number.parseInt(calFermentacion, 10),
        temperatura: Number.parseFloat(calTemperatura) || 0,
        observaciones: calObs,
        estado: calEstado,
      });
      setRegistrosCalidad((prev) => [nuevo, ...prev]);
      setCalFinca('');
      setCalHumedad('');
      setCalFermentacion('');
      setCalTemperatura('');
      setCalObs('');
      setCalSuccess(true);
      setTimeout(() => setCalSuccess(false), 3000);
    } catch (error) {
      Alert.alert(
        'No se pudo guardar el registro',
        error instanceof Error ? error.message : 'Inténtalo de nuevo.',
      );
    } finally {
      setGuardandoCalidad(false);
    }
  };

  /* ============================================================
     LOGIN
     ============================================================ */

  if (restoringSession) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.sessionLoading}>
          <ActivityIndicator color={COLORS.green} />
          <Text style={styles.sessionLoadingText}>Cargando sesión...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (screen === 'login') {
    return (
      <SafeAreaView style={styles.safeArea}>
        <ScrollView
          contentContainerStyle={styles.loginContainer}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.topBar}>
            <Text style={styles.topBarTitle}>login</Text>

            <View style={styles.gearButton}>
              <IconGear />
            </View>
          </View>

          <View style={styles.loginContent}>
            <View style={styles.logoContainer}>
              <IconLeaf size={55} />

              <Text style={styles.logoTitle}>
                CacaoApp
              </Text>

              <Text style={styles.loginTitle}>
                Iniciar sesión
              </Text>
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>
                Correo electrónico
              </Text>

              <TextInput
                value={email}
                onChangeText={setEmail}
                placeholder="prueba@cacaoapp.com"
                placeholderTextColor="#999"
                keyboardType="email-address"
                autoCapitalize="none"
                style={styles.input}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>
                Contraseña
              </Text>

              <View style={styles.passwordContainer}>
                <TextInput
                  value={password}
                  onChangeText={setPassword}
                  placeholder="••••••"
                  placeholderTextColor="#999"
                  secureTextEntry={!showPass}
                  style={styles.passwordInput}
                />

                <Pressable
                  onPress={() =>
                    setShowPass(!showPass)
                  }
                  style={styles.eyeButton}
                >
                  <IconEye
                    open={showPass}
                    size={18}
                  />
                </Pressable>
              </View>
            </View>

            {loginError ? (
              <Text style={styles.errorText}>
                {loginError}
              </Text>
            ) : null}

            <Pressable
              onPress={handleLogin}
              disabled={loginLoading}
              style={[
                styles.primaryButton,
                loginLoading &&
                  styles.disabledButton,
              ]}
            >
              {loginLoading ? (
                <View style={styles.buttonContent}>
                  <ActivityIndicator
                    color="#fff"
                  />

                  <Text
                    style={styles.primaryButtonText}
                  >
                    Ingresando...
                  </Text>
                </View>
              ) : (
                <Text style={styles.primaryButtonText}>
                  Iniciar sesión
                </Text>
              )}
            </Pressable>

            <View style={styles.dividerContainer}>
              <View style={styles.divider} />

              <Text style={styles.dividerText}>
                o
              </Text>

              <View style={styles.divider} />
            </View>

            <View style={styles.registerCard}>
              <Text style={styles.registerQuestion}>
                ¿No tienes cuenta?
              </Text>

              <Text style={styles.registerDescription}>
                Regístrate para acceder a todas las
                funciones de gestión de tu finca
                cacaotera.
              </Text>

              <Pressable
                onPress={() =>
                  setScreen('register')
                }
                style={styles.outlineButton}
              >
                <Text
                  style={
                    styles.outlineButtonText
                  }
                >
                  Crear cuenta nueva
                </Text>
              </Pressable>
            </View>

            <View style={styles.requirementsContainer}>
              <RequisitoCard
                tipo="funcional"
                items={[
                  'Registrar y geolocalizar fincas cacaoteras y estimaciones de cosecha.',
                  'Registrar parámetros de calidad del grano (humedad, fermentación) en el punto de acopio.',
                  'Trazar rutas óptimas de recolección para la camioneta/camión de la asociación.',
                ]}
              />

              <RequisitoCard
                tipo="no_funcional"
                items={[
                  'Usabilidad: Interfaz simplificada con alto contraste visual e íconos para usuarios con baja alfabetización digital.',
                  'Rendimiento: Consumo mínimo de batería y datos móviles.',
                  'Conectividad: Se requiere acceso estable al servidor para consultar y guardar cambios.',
                ]}
              />
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  /* ============================================================
     REGISTRO
     ============================================================ */

  if (screen === 'register') {
    return (
      <SafeAreaView style={styles.safeArea}>
        <Header
          title="Crear cuenta"
          back="login"
          setScreen={setScreen}
        />

        <ScrollView
          contentContainerStyle={
            styles.scrollContent
          }
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.registerLogo}>
            <IconLeaf size={42} />

            <Text style={styles.registerTitle}>
              Registro
            </Text>

            <Text style={styles.registerSubtitle}>
              Ingresa tus datos para unirte a
              CacaoApp
            </Text>
          </View>

          {regSuccess ? (
            <View style={styles.successCard}>
              <Text style={styles.successEmoji}>
                ✅
              </Text>

              <Text style={styles.successTitle}>
                ¡Cuenta creada exitosamente!
              </Text>

              <Text style={styles.successText}>
                Tu cuenta ha sido registrada. Ya
                puedes iniciar sesión con tus datos.
              </Text>

              <Pressable
                onPress={() => {
                  setRegSuccess(false);
                  setScreen('login');
                }}
                style={styles.primaryButton}
              >
                <Text
                  style={styles.primaryButtonText}
                >
                  Ir al inicio de sesión
                </Text>
              </Pressable>
            </View>
          ) : (
            <>
              <View style={styles.sectionCard}>
                <View style={styles.sectionTitleRow}>
                  <View style={styles.numberCircle}>
                    <Text
                      style={styles.numberText}
                    >
                      1
                    </Text>
                  </View>

                  <Text
                    style={styles.sectionTitle}
                  >
                    Datos personales
                  </Text>
                </View>

                <Text style={styles.label}>
                  Nombre completo *
                </Text>

                <TextInput
                  value={regNombre}
                  onChangeText={setRegNombre}
                  placeholder="Ej: Carlos Andrade"
                  placeholderTextColor="#999"
                  style={styles.smallInput}
                />

                <Text style={styles.label}>
                  Teléfono / WhatsApp
                </Text>

                <TextInput
                  value={regTelefono}
                  onChangeText={setRegTelefono}
                  placeholder="Ej: 3201234567"
                  placeholderTextColor="#999"
                  keyboardType="phone-pad"
                  style={styles.smallInput}
                />

                <Text style={styles.label}>
                  Municipio
                </Text>

                <View style={styles.optionsContainer}>
                  {[
                    'Chigorodó',
                    'Apartadó',
                    'Turbo',
                    'Carepa',
                    'Mutatá',
                    'Otro',
                  ].map((municipio) => (
                    <Pressable
                      key={municipio}
                      onPress={() =>
                        setRegMunicipio(
                          municipio,
                        )
                      }
                      style={[
                        styles.optionButton,
                        regMunicipio ===
                          municipio &&
                          styles.optionSelected,
                      ]}
                    >
                      <Text
                        style={[
                          styles.optionText,
                          regMunicipio ===
                            municipio &&
                            styles.optionTextSelected,
                        ]}
                      >
                        {municipio}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>

              <View style={styles.sectionCard}>
                <View style={styles.sectionTitleRow}>
                  <View style={styles.numberCircle}>
                    <Text
                      style={styles.numberText}
                    >
                      2
                    </Text>
                  </View>

                  <Text
                    style={styles.sectionTitle}
                  >
                    Datos de acceso
                  </Text>
                </View>

                <Text style={styles.label}>
                  Correo electrónico *
                </Text>

                <TextInput
                  value={regEmail}
                  onChangeText={setRegEmail}
                  placeholder="tu@correo.com"
                  placeholderTextColor="#999"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  style={styles.smallInput}
                />

                <Text style={styles.label}>
                  Contraseña *
                </Text>

                <View style={styles.passwordContainer}>
                  <TextInput
                    value={regPassword}
                    onChangeText={setRegPassword}
                    placeholder="Mínimo 6 caracteres"
                    placeholderTextColor="#999"
                    secureTextEntry={
                      !showRegPass
                    }
                    style={styles.passwordInput}
                  />

                  <Pressable
                    onPress={() =>
                      setShowRegPass(
                        !showRegPass,
                      )
                    }
                    style={styles.eyeButton}
                  >
                    <IconEye
                      open={showRegPass}
                      size={17}
                    />
                  </Pressable>
                </View>

                {regPassword ? (
                  <View style={styles.passwordStrength}>
                    {[1, 2, 3, 4].map((i) => {
                      const active =
                        regPassword.length >=
                        i * 3;

                      return (
                        <View
                          key={i}
                          style={[
                            styles.strengthBar,
                            active &&
                              styles.strengthActive,
                          ]}
                        />
                      );
                    })}

                    <Text
                      style={styles.strengthText}
                    >
                      {regPassword.length >= 10
                        ? 'Fuerte'
                        : regPassword.length >= 6
                          ? 'Media'
                          : 'Débil'}
                    </Text>
                  </View>
                ) : null}

                <Text style={styles.label}>
                  Confirmar contraseña *
                </Text>

                <TextInput
                  value={regConfirm}
                  onChangeText={setRegConfirm}
                  placeholder="Repite la contraseña"
                  placeholderTextColor="#999"
                  secureTextEntry
                  style={[
                    styles.smallInput,
                    regConfirm &&
                      regConfirm !==
                        regPassword &&
                      styles.inputError,
                  ]}
                />

                {regConfirm &&
                regConfirm !== regPassword ? (
                  <Text style={styles.errorSmall}>
                    Las contraseñas no coinciden
                  </Text>
                ) : null}
              </View>

              <View style={styles.infoBlueCard}>
                <Text
                  style={styles.infoBlueTitle}
                >
                  Al registrarte podrás:
                </Text>

                <Text style={styles.infoBlueText}>
                  • Registrar y geolocalizar tus
                  fincas cacaoteras
                </Text>

                <Text style={styles.infoBlueText}>
                  • Registrar parámetros de calidad
                  del grano en acopio
                </Text>

                <Text style={styles.infoBlueText}>
                  • Consultar y trazar rutas de
                  recolección
                </Text>

                <Text style={styles.infoBlueText}>
                  • Ver el mapa con todas tus fincas
                </Text>
              </View>

              {regError ? (
                <Text style={styles.errorBox}>
                  {regError}
                </Text>
              ) : null}

              <Pressable
                onPress={handleRegister}
                disabled={regLoading}
                style={[
                  styles.primaryButton,
                  regLoading &&
                    styles.disabledButton,
                ]}
              >
                {regLoading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text
                    style={
                      styles.primaryButtonText
                    }
                  >
                    ✅ Crear mi cuenta
                  </Text>
                )}
              </Pressable>

              <Pressable
                onPress={() =>
                  setScreen('login')
                }
                style={styles.linkButton}
              >
                <Text style={styles.linkText}>
                  Ya tengo cuenta → Iniciar sesión
                </Text>
              </Pressable>
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    );
  }

  /* ============================================================
     HOME
     ============================================================ */

  if (screen === 'home') {
    const menu = [
      {
        icon: <IconLeaf size={34} />,
        title: 'Mis fincas',
        description:
          'Ver y registrar mis fincas',
        target: 'fincas' as Screen,
      },
      {
        icon: <IconPin size={34} />,
        title: 'Mapa',
        description:
          'Ver la ubicación de mi finca',
        target: 'mapa' as Screen,
      },
      {
        icon: <IconRoad size={34} />,
        title: 'Rutas',
        description: 'Consultar mis rutas',
        target: 'rutas' as Screen,
      },
      {
        icon: <IconGrain size={34} />,
        title: 'Calidad del Grano',
        description:
          'Registrar humedad y fermentación en acopio',
        target: 'calidad' as Screen,
        highlight: true,
      },
    ];

    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.homeContainer}>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>
              CacaoApp
            </Text>

            <Pressable
              onPress={handleLogout}
              style={styles.logoutButton}
              accessibilityRole="button"
              accessibilityLabel="Cerrar sesión"
            >
              <Text style={styles.logoutButtonText}>Salir</Text>
            </Pressable>
          </View>

          <ScrollView
            contentContainerStyle={
              styles.scrollContent
            }
          >
            <View style={styles.hero}>
              <IconLeaf size={62} />

              <Text style={styles.heroTitle}>
                CacaoApp
              </Text>

              <Text style={styles.heroSubtitle}>
                Gestión sencilla de tu finca de cacao
              </Text>
            </View>

            <Text style={styles.welcomeTitle}>
              ¡Bienvenido!
            </Text>

            <Text style={styles.welcomeText}>
              Selecciona una opción para comenzar.
            </Text>

            {menu.map((item) => (
              <Pressable
                key={item.title}
                onPress={() =>
                  setScreen(item.target)
                }
                style={[
                  styles.menuCard,
                  item.highlight &&
                    styles.menuCardHighlight,
                ]}
              >
                <View style={styles.menuIcon}>
                  {item.icon}
                </View>

                <View style={styles.menuText}>
                  <Text
                    style={[
                      styles.menuTitle,
                      item.highlight &&
                        styles.menuTitleHighlight,
                    ]}
                  >
                    {item.title}
                  </Text>

                  <Text style={styles.menuDescription}>
                    {item.description}
                  </Text>
                </View>

                <Text style={styles.menuArrow}>
                  ›
                </Text>
              </Pressable>
            ))}

            <Text style={styles.footerText}>
              CacaoApp · Tu finca siempre contigo
            </Text>
          </ScrollView>
        </View>
      </SafeAreaView>
    );
  }

  /* ============================================================
     FINCAS
     ============================================================ */

  if (screen === 'fincas') {
    return (
      <SafeAreaView style={styles.safeArea}>
        <Header
          title="Mis fincas"
          back="home"
          setScreen={setScreen}
          onLogout={handleLogout}
        />

        <ScrollView
          contentContainerStyle={
            styles.scrollContent
          }
        >
          <View style={styles.pageTitleRow}>
            <IconLeaf size={28} />

            <Text style={styles.pageTitle}>
              Mis fincas
            </Text>
          </View>

          <Text style={styles.label}>
            Nombre de la finca
          </Text>

          <TextInput
            value={nuevaFinca}
            onChangeText={setNuevaFinca}
            placeholder="Ejemplo: Finca El Cacao"
            placeholderTextColor="#999"
            style={styles.input}
          />

          {coordActual ? (
            <View style={styles.locationCard}>
              <Text style={styles.locationText}>
                📍 Lat: {coordActual.lat}
              </Text>

              <Text style={styles.locationText}>
                Long: {coordActual.lng}
              </Text>
            </View>
          ) : null}

          <Pressable
            onPress={handleObtenerUbicacion}
            disabled={obteniendo}
            style={[
              styles.primaryButton,
              obteniendo &&
                styles.disabledButton,
            ]}
          >
            {obteniendo ? (
              <View style={styles.buttonContent}>
                <ActivityIndicator color="#fff" />

                <Text
                  style={styles.primaryButtonText}
                >
                  Obteniendo ubicación...
                </Text>
              </View>
            ) : (
              <View style={styles.buttonContent}>
                <IconPin size={20} />

                <Text
                  style={styles.primaryButtonText}
                >
                  Obtener ubicación
                </Text>
              </View>
            )}
          </Pressable>

          <Pressable
            onPress={handleGuardarFinca}
            disabled={!nuevaFinca || !coordActual || guardandoFinca}
            style={[
              styles.primaryButton,
              (!nuevaFinca || !coordActual || guardandoFinca) &&
                styles.disabledButton,
            ]}
          >
            <View style={styles.buttonContent}>
              {guardandoFinca ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <IconSave size={19} />
              )}

              <Text
                style={styles.primaryButtonText}
              >
                {guardandoFinca ? 'Guardando...' : 'Guardar finca'}
              </Text>
            </View>
          </Pressable>

          <Text style={styles.sectionHeading}>
            Fincas registradas
          </Text>

          {fincas.map((finca) => (
            <View
              key={finca.id}
              style={styles.fincaCard}
            >
              <View style={styles.row}>
                <IconLeaf size={22} />

                <Text style={styles.fincaName}>
                  {finca.nombre}
                </Text>
              </View>

              <Text style={styles.coordinateText}>
                Latitud: {finca.lat}
              </Text>

              <Text style={styles.coordinateText}>
                Longitud: {finca.lng}
              </Text>

              <Pressable
                onPress={() =>
                  handleEliminarFinca(
                    finca.id,
                  )
                }
                style={styles.deleteButton}
              >
                <IconTrash size={18} />

                <Text style={styles.deleteText}>
                  Eliminar finca
                </Text>
              </Pressable>
            </View>
          ))}

          {fincas.length === 0 ? (
            <Text style={styles.emptyText}>
              No hay fincas registradas
            </Text>
          ) : null}
        </ScrollView>
      </SafeAreaView>
    );
  }

  /* ============================================================
     MAPA
     ============================================================ */

  if (screen === 'mapa') {
    return (
      <SafeAreaView style={styles.safeArea}>
        <Header
          title="Mapa"
          back="home"
          setScreen={setScreen}
          onLogout={handleLogout}
        />

        <ScrollView
          contentContainerStyle={
            styles.scrollContent
          }
        >
          <View style={styles.mapContainer}>
            <UrbanMap fincas={fincas} />
          </View>

          <Text style={styles.mapFooter}>
            Plano urbano de Chigorodó con vías, barrios y puntos de interés según
            los datos disponibles en OpenStreetMap.
          </Text>

          <Text style={styles.sectionHeading}>
            Fincas en el mapa
          </Text>

          {fincas.map((finca) => (
            <View
              key={finca.id}
              style={styles.mapListCard}
            >
              <View style={styles.blueCircle}>
                <Text>🌱</Text>
              </View>

              <View>
                <Text style={styles.mapListName}>
                  {finca.nombre}
                </Text>

                <Text style={styles.mapListCoords}>
                  Lat: {finca.lat} | Long:{' '}
                  {finca.lng}
                </Text>
              </View>
            </View>
          ))}

        </ScrollView>
      </SafeAreaView>
    );
  }

  /* ============================================================
     RUTAS
     ============================================================ */

  if (screen === 'rutas') {
    return (
      <SafeAreaView style={styles.safeArea}>
        <Header
          title="Rutas"
          back="home"
          setScreen={setScreen}
          onLogout={handleLogout}
        />

        <ScrollView
          contentContainerStyle={
            styles.scrollContent
          }
        >
          <Text style={styles.label}>
            Selecciona una finca
          </Text>

          {fincas.map((finca) => (
            <Pressable
              key={finca.id}
              onPress={() =>
                setFincaSelRuta(finca)
              }
              style={[
                styles.fincaSelectCard,
                fincaSelRuta?.id === finca.id &&
                  styles.fincaSelected,
              ]}
            >
              <IconLeaf size={21} />

              <Text style={styles.fincaSelectText}>
                {finca.nombre}
              </Text>

              {fincaSelRuta?.id === finca.id ? (
                <IconCheck size={17} />
              ) : null}
            </Pressable>
          ))}

          <Text style={styles.label}>
            Nombre de la ruta
          </Text>

          <TextInput
            value={nombreRuta}
            onChangeText={setNombreRuta}
            placeholder="Ruta de la finca"
            placeholderTextColor="#999"
            style={styles.input}
          />

          {fincaSelRuta ? (
            <View style={styles.selectedFinca}>
              <Text style={styles.selectedLabel}>
                Finca seleccionada
              </Text>

              <View style={styles.row}>
                <IconLeaf size={18} />

                <Text
                  style={
                    styles.selectedFincaName
                  }
                >
                  {fincaSelRuta.nombre}
                </Text>
              </View>
            </View>
          ) : null}

          {grabandoRuta ? (
            <View style={styles.recordingCard}>
              <Text style={styles.recordingTitle}>
                📍 Puntos GPS registrados
              </Text>

              <Text style={styles.gpsCounter}>
                {puntosGPS}
              </Text>

              <View style={styles.recordingStatus}>
                <View
                  style={styles.recordingDot}
                />

                <Text
                  style={styles.recordingText}
                >
                  Grabando recorrido...
                </Text>
              </View>
            </View>
          ) : null}

          {!grabandoRuta ? (
            <Pressable
              onPress={() => {
                if (
                  fincaSelRuta &&
                  nombreRuta
                ) {
                  setGrabandoRuta(true);
                  setPuntosGPS(0);
                }
              }}
              disabled={
                !fincaSelRuta ||
                !nombreRuta
              }
              style={[
                styles.primaryButton,
                (!fincaSelRuta ||
                  !nombreRuta) &&
                  styles.disabledButton,
              ]}
            >
              <Text style={styles.primaryButtonText}>
                ▶ Iniciar grabación de ruta
              </Text>
            </Pressable>
          ) : (
            <Pressable
              onPress={handleGuardarRuta}
              disabled={guardandoRuta}
              style={[
                styles.stopButton,
                guardandoRuta && styles.disabledButton,
              ]}
            >
              {guardandoRuta ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <IconSave size={19} />
              )}

              <Text style={styles.stopButtonText}>
                {guardandoRuta ? 'Guardando...' : 'Terminar y guardar ruta'}
              </Text>
            </Pressable>
          )}

          <Text style={styles.sectionHeading}>
            Rutas guardadas
          </Text>

          {rutas.map((ruta) => (
            <View
              key={ruta.id}
              style={styles.routeCard}
            >
              <View style={styles.row}>
                <IconRoad size={21} />

                <Text style={styles.routeName}>
                  {ruta.nombre}
                </Text>
              </View>

              <Text style={styles.routeInfo}>
                🌿 Finca: {ruta.finca}
              </Text>

              <Text style={styles.routeInfo}>
                📍 Puntos GPS: {ruta.puntos}
              </Text>

              <Text style={styles.routeSaved}>
                Guardada en {ruta.guardada}
              </Text>
            </View>
          ))}

          {rutas.length === 0 ? (
            <Text style={styles.emptyText}>
              No hay rutas guardadas
            </Text>
          ) : null}
        </ScrollView>
      </SafeAreaView>
    );
  }

  /* ============================================================
     CALIDAD
     ============================================================ */

  if (screen === 'calidad') {
    const humedad =
      parseFloat(calHumedad);

    const fermentacion =
      parseInt(calFermentacion);

    const temperatura =
      parseFloat(calTemperatura);

    return (
      <SafeAreaView style={styles.safeArea}>
        <Header
          title="Calidad del Grano"
          back="home"
          setScreen={setScreen}
          onLogout={handleLogout}
        />

        <ScrollView
          contentContainerStyle={
            styles.scrollContent
          }
        >
          <View style={styles.pageTitleRow}>
            <IconGrain size={30} />

            <Text style={styles.qualityTitle}>
              Parámetros de Calidad
            </Text>
          </View>

          <Text style={styles.qualitySubtitle}>
            Registro en punto de acopio · Chigorodó
          </Text>

          <Pressable
            onPress={() =>
              setInfoOpen(!infoOpen)
            }
            style={styles.infoCultivo}
          >
            <View style={styles.infoHeader}>
              <Text style={styles.infoTitle}>
                📚 ¿Cuándo está listo el cacao?
              </Text>

              <Text style={styles.infoArrow}>
                {infoOpen ? '▲' : '▼'}
              </Text>
            </View>

            {infoOpen ? (
              <View style={styles.infoContent}>
                <View style={styles.infoWhiteCard}>
                  <Text style={styles.infoCardTitle}>
                    🌿 Condiciones de cultivo del
                    cacao
                  </Text>

                  <Text style={styles.infoItem}>
                    • Temperatura: 20–30°C
                  </Text>

                  <Text style={styles.infoItem}>
                    • Precipitación: 1.500–2.500
                    mm/año
                  </Text>

                  <Text style={styles.infoItem}>
                    • Humedad relativa: 70–90%
                  </Text>

                  <Text style={styles.infoItem}>
                    • Altitud: 0–900 msnm
                  </Text>

                  <Text style={styles.infoItem}>
                    • Suelo: fértil, bien drenado,
                    pH 6.0–7.5
                  </Text>
                </View>

                <View style={styles.infoWhiteCard}>
                  <Text style={styles.infoCardTitle}>
                    ⏱ Tiempo de fermentación
                  </Text>

                  <Text style={styles.infoItem}>
                    • CCN-51: 5–6 días
                  </Text>

                  <Text style={styles.infoItem}>
                    • Cacao fino de aroma: 6–7 días
                  </Text>

                  <Text style={styles.infoItem}>
                    • Temperatura: 45–50°C
                  </Text>

                  <Text style={styles.infoItem}>
                    • Volteo: cada 24–48 h
                  </Text>
                </View>

                <View style={styles.infoWhiteCard}>
                  <Text style={styles.infoCardTitle}>
                    💧 Humedad para comercialización
                  </Text>

                  <Text style={styles.infoItem}>
                    • Óptima: 6–8%
                  </Text>

                  <Text style={styles.infoItem}>
                    • Máxima aceptada: 8%
                  </Text>

                  <Text style={styles.infoItem}>
                    • Riesgo de hongos: &gt; 8%
                  </Text>
                </View>

                <View style={styles.infoWhiteCard}>
                  <Text style={styles.infoCardTitle}>
                    🔬 Índice de fermentación
                  </Text>

                  <Text style={styles.infoItem}>
                    • Bien fermentado: &gt;75%
                  </Text>

                  <Text style={styles.infoItem}>
                    • Parcial: 50–75%
                  </Text>

                  <Text style={styles.infoItem}>
                    • Pizarroso: &lt;50%
                  </Text>
                </View>
              </View>
            ) : null}
          </Pressable>

          <Text style={styles.label}>
            Finca de origen *
          </Text>

          <View style={styles.optionsContainer}>
            {fincas.map((finca) => (
              <Pressable
                key={finca.id}
                onPress={() =>
                  setCalFinca(finca.nombre)
                }
                style={[
                  styles.optionButton,
                  calFinca === finca.nombre &&
                    styles.brownOptionSelected,
                ]}
              >
                <Text
                  style={[
                    styles.optionText,
                    calFinca ===
                      finca.nombre &&
                      styles.brownOptionText,
                  ]}
                >
                  {finca.nombre}
                </Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.label}>
            💧 Humedad del grano (%)
          </Text>

          <TextInput
            value={calHumedad}
            onChangeText={setCalHumedad}
            placeholder="Ej: 7.2"
            placeholderTextColor="#999"
            keyboardType="decimal-pad"
            style={styles.brownInput}
          />

          {calHumedad ? (
            <View
              style={[
                styles.validationBox,
                humedad >= 6 &&
                humedad <= 8
                  ? styles.validationGreen
                  : humedad > 8
                    ? styles.validationRed
                    : styles.validationYellow,
              ]}
            >
              <Text style={styles.validationText}>
                {humedad >= 6 && humedad <= 8
                  ? '✅ Humedad óptima para comercialización (6–8%)'
                  : humedad > 8
                    ? '⚠️ Humedad alta — riesgo de hongos. Secar más.'
                    : '⚠️ Humedad muy baja — puede quebrar el grano.'}
              </Text>
            </View>
          ) : null}

          <Text style={styles.label}>
            ⏱ Días de fermentación
          </Text>

          <TextInput
            value={calFermentacion}
            onChangeText={setCalFermentacion}
            placeholder="Ej: 6"
            placeholderTextColor="#999"
            keyboardType="number-pad"
            style={styles.brownInput}
          />

          {calFermentacion ? (
            <View
              style={[
                styles.validationBox,
                fermentacion >= 5 &&
                fermentacion <= 7
                  ? styles.validationGreen
                  : styles.validationYellow,
              ]}
            >
              <Text style={styles.validationText}>
                {fermentacion >= 5 &&
                fermentacion <= 7
                  ? '✅ Tiempo de fermentación adecuado (5–7 días)'
                  : fermentacion < 5
                    ? '⚠️ Posible sub-fermentación.'
                    : '⚠️ Sobre-fermentación. Puede afectar sabor.'}
              </Text>
            </View>
          ) : null}

          <Text style={styles.label}>
            🌡 Temperatura de fermentación (°C)
          </Text>

          <TextInput
            value={calTemperatura}
            onChangeText={setCalTemperatura}
            placeholder="Ej: 47"
            placeholderTextColor="#999"
            keyboardType="decimal-pad"
            style={styles.brownInput}
          />

          {calTemperatura ? (
            <View
              style={[
                styles.validationBox,
                temperatura >= 45 &&
                temperatura <= 50
                  ? styles.validationGreen
                  : styles.validationYellow,
              ]}
            >
              <Text style={styles.validationText}>
                {temperatura >= 45 &&
                temperatura <= 50
                  ? '✅ Temperatura óptima de fermentación (45–50°C)'
                  : '⚠️ Temperatura fuera del rango óptimo (45–50°C)'}
              </Text>
            </View>
          ) : null}

          <Text style={styles.label}>
            Estado del grano
          </Text>

          {[
            {
              value: 'bien_fermentado' as const,
              title: 'Bien fermentado',
              description:
                '>75% granos marrón/violeta',
              border: '#22C55E',
              bg: '#F0FDF4',
            },
            {
              value: 'parcial' as const,
              title:
                'Parcialmente fermentado',
              description:
                '50–75% granos fermentados',
              border: '#EAB308',
              bg: '#FEFCE8',
            },
            {
              value: 'sin_fermentar' as const,
              title:
                'Sin fermentar (pizarroso)',
              description:
                '<50% granos fermentados',
              border: '#EF4444',
              bg: '#FEF2F2',
            },
          ].map((option) => (
            <Pressable
              key={option.value}
              onPress={() =>
                setCalEstado(option.value)
              }
              style={[
                styles.fermentationOption,
                calEstado === option.value && {
                  borderColor:
                    option.border,
                  backgroundColor:
                    option.bg,
                },
              ]}
            >
              <View
                style={[
                  styles.radio,
                  calEstado === option.value &&
                    styles.radioSelected,
                ]}
              >
                {calEstado ===
                option.value ? (
                  <View
                    style={
                      styles.radioInner
                    }
                  />
                ) : null}
              </View>

              <View style={{ flex: 1 }}>
                <Text
                  style={
                    styles.fermentationTitle
                  }
                >
                  {option.title}
                </Text>

                <Text
                  style={
                    styles.fermentationDescription
                  }
                >
                  {option.description}
                </Text>
              </View>
            </Pressable>
          ))}

          <Text style={styles.label}>
            Observaciones
          </Text>

          <TextInput
            value={calObs}
            onChangeText={setCalObs}
            placeholder="Ej: Grano bien formado, color uniforme..."
            placeholderTextColor="#999"
            multiline
            numberOfLines={4}
            textAlignVertical="top"
            style={styles.textArea}
          />

          {calSuccess ? (
            <View style={styles.successSmall}>
              <Text style={styles.successSmallText}>
                ✅ Registro de calidad guardado
                exitosamente
              </Text>
            </View>
          ) : null}

          <Pressable
            onPress={handleGuardarCalidad}
            disabled={
              !calFinca ||
              !calHumedad ||
              !calFermentacion ||
              guardandoCalidad
            }
            style={[
              styles.brownButton,
              (!calFinca ||
                !calHumedad ||
                !calFermentacion ||
                guardandoCalidad) &&
                styles.disabledButton,
            ]}
          >
            {guardandoCalidad ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <IconSave size={19} />
            )}

            <Text style={styles.primaryButtonText}>
              {guardandoCalidad ? 'Guardando...' : 'Guardar registro de calidad'}
            </Text>
          </Pressable>

          <Text style={styles.sectionHeading}>
            Registros anteriores
          </Text>

          {registrosCalidad.map((registro) => (
            <View
              key={registro.id}
              style={styles.qualityCard}
            >
              <View style={styles.qualityHeader}>
                <View>
                  <View style={styles.row}>
                    <IconLeaf size={15} />

                    <Text
                      style={
                        styles.qualityFinca
                      }
                    >
                      {registro.finca}
                    </Text>
                  </View>

                  <Text style={styles.dateText}>
                    {registro.fecha}
                  </Text>
                </View>

                <EstadoFermentacion
                  estado={registro.estado}
                />
              </View>

              <View style={styles.metricsRow}>
                <View
                  style={[
                    styles.metric,
                    {
                      backgroundColor:
                        '#EFF6FF',
                    },
                  ]}
                >
                  <Text style={styles.metricLabel}>
                    Humedad
                  </Text>

                  <Text style={styles.metricValue}>
                    {registro.humedad}%
                  </Text>
                </View>

                <View
                  style={[
                    styles.metric,
                    {
                      backgroundColor:
                        '#FFF7ED',
                    },
                  ]}
                >
                  <Text style={styles.metricLabel}>
                    Fermentación
                  </Text>

                  <Text style={styles.metricValue}>
                    {registro.fermentacion} días
                  </Text>
                </View>

                <View
                  style={[
                    styles.metric,
                    {
                      backgroundColor:
                        '#FEF2F2',
                    },
                  ]}
                >
                  <Text style={styles.metricLabel}>
                    Temp.
                  </Text>

                  <Text style={styles.metricValue}>
                    {registro.temperatura}°C
                  </Text>
                </View>
              </View>

              {registro.observaciones ? (
                <Text style={styles.observation}>
                  💬 {registro.observaciones}
                </Text>
              ) : null}
            </View>
          ))}
        </ScrollView>
      </SafeAreaView>
    );
  }

  return null;
}

/* ============================================================
   ESTILOS
   ============================================================ */

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },

  loginContainer: {
    flexGrow: 1,
    backgroundColor: '#FFFFFF',
  },

  homeContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },

  sessionLoading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  sessionLoadingText: {
    marginTop: 10,
    color: COLORS.gray,
    fontSize: 14,
  },

  scrollContent: {
    paddingHorizontal: 20,
    paddingVertical: 20,
    paddingBottom: 40,
  },

  /* HEADER */

  header: {
    height: 58,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5',
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#202020',
  },

  backButton: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 4,
  },

  backText: {
    fontSize: 35,
    color: '#555555',
    lineHeight: 35,
  },

  gearButton: {
    width: 38,
    height: 38,
    borderRadius: 20,
    backgroundColor: '#EEEEEE',
    alignItems: 'center',
    justifyContent: 'center',
  },

  logoutButton: {
    minWidth: 62,
    minHeight: 38,
    paddingHorizontal: 12,
    borderRadius: 20,
    backgroundColor: COLORS.lightGreen,
    alignItems: 'center',
    justifyContent: 'center',
  },

  logoutButtonText: {
    color: COLORS.darkGreen,
    fontSize: 13,
    fontWeight: '700',
  },

  topBar: {
    height: 58,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#EEEEEE',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  topBarTitle: {
    fontWeight: '700',
    fontSize: 16,
    color: '#333333',
  },

  /* LOGIN */

  loginContent: {
    paddingHorizontal: 24,
    paddingVertical: 30,
  },

  logoContainer: {
    alignItems: 'center',
    marginBottom: 36,
  },

  logoTitle: {
    fontSize: 31,
    fontWeight: '800',
    color: '#222222',
    marginTop: 4,
  },

  loginTitle: {
    fontSize: 21,
    fontWeight: '700',
    color: COLORS.green,
    marginTop: 5,
  },

  formGroup: {
    marginBottom: 18,
  },

  label: {
    fontSize: 14,
    fontWeight: '700',
    color: '#303030',
    marginBottom: 7,
  },

  input: {
    width: '100%',
    borderWidth: 2,
    borderColor: COLORS.green,
    borderRadius: 12,
    paddingHorizontal: 15,
    paddingVertical: 13,
    fontSize: 16,
    color: '#333333',
    backgroundColor: '#FFFFFF',
  },

  smallInput: {
    width: '100%',
    borderWidth: 2,
    borderColor: '#D0D0D0',
    borderRadius: 9,
    paddingHorizontal: 12,
    paddingVertical: 11,
    fontSize: 14,
    color: '#333333',
    backgroundColor: '#FFFFFF',
    marginBottom: 14,
  },

  passwordContainer: {
    width: '100%',
    minHeight: 52,
    borderWidth: 2,
    borderColor: COLORS.green,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },

  passwordInput: {
    flex: 1,
    paddingHorizontal: 15,
    paddingVertical: 13,
    fontSize: 16,
    color: '#333333',
  },

  eyeButton: {
    paddingHorizontal: 12,
    paddingVertical: 10,
  },

  primaryButton: {
    width: '100%',
    minHeight: 54,
    borderRadius: 12,
    backgroundColor: COLORS.darkGreen,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
    paddingHorizontal: 15,
  },

  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },

  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },

  disabledButton: {
    opacity: 0.4,
  },

  errorText: {
    color: '#DC2626',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 4,
  },

  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 22,
    gap: 12,
  },

  divider: {
    flex: 1,
    height: 1,
    backgroundColor: '#E0E0E0',
  },

  dividerText: {
    color: '#999999',
    fontSize: 14,
  },

  registerCard: {
    backgroundColor: '#F0F8EE',
    borderWidth: 1,
    borderColor: COLORS.green,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },

  registerQuestion: {
    fontSize: 14,
    color: '#444444',
    marginBottom: 4,
  },

  registerDescription: {
    fontSize: 12,
    color: '#777777',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 12,
  },

  outlineButton: {
    width: '100%',
    borderWidth: 2,
    borderColor: COLORS.green,
    borderRadius: 11,
    paddingVertical: 12,
    alignItems: 'center',
  },

  outlineButtonText: {
    color: COLORS.darkGreen,
    fontSize: 15,
    fontWeight: '700',
  },

  requirementsContainer: {
    marginTop: 22,
  },

  requirementCard: {
    borderWidth: 1,
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 9,
  },

  requirementHeader: {
    minHeight: 50,
    paddingHorizontal: 15,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  requirementTitle: {
    fontSize: 13,
    fontWeight: '700',
    flex: 1,
  },

  arrow: {
    fontSize: 16,
    color: '#555555',
  },

  requirementBody: {
    padding: 14,
    backgroundColor: '#FFFFFF',
  },

  requirementRow: {
    flexDirection: 'row',
    marginBottom: 6,
  },

  bullet: {
    width: 20,
    color: '#555555',
  },

  requirementText: {
    flex: 1,
    color: '#555555',
    fontSize: 13,
    lineHeight: 18,
  },

  /* REGISTER */

  registerLogo: {
    alignItems: 'center',
    marginBottom: 20,
  },

  registerTitle: {
    fontSize: 25,
    fontWeight: '800',
    color: COLORS.green,
    marginTop: 3,
  },

  registerSubtitle: {
    fontSize: 13,
    color: '#777777',
    textAlign: 'center',
    marginTop: 4,
  },

  sectionCard: {
    backgroundColor: '#F7F7F7',
    borderRadius: 12,
    padding: 16,
    marginBottom: 15,
  },

  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },

  numberCircle: {
    width: 25,
    height: 25,
    borderRadius: 13,
    backgroundColor: COLORS.green,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },

  numberText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },

  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#333333',
  },

  optionsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
    marginBottom: 10,
  },

  optionButton: {
    borderWidth: 1,
    borderColor: '#CCCCCC',
    borderRadius: 9,
    paddingHorizontal: 10,
    paddingVertical: 9,
    backgroundColor: '#FFFFFF',
  },

  optionSelected: {
    borderColor: COLORS.green,
    backgroundColor: '#F0F8EE',
  },

  optionText: {
    fontSize: 13,
    color: '#555555',
  },

  optionTextSelected: {
    color: COLORS.green,
    fontWeight: '700',
  },

  passwordStrength: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: -6,
    marginBottom: 14,
  },

  strengthBar: {
    flex: 1,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#DDDDDD',
  },

  strengthActive: {
    backgroundColor: '#EAB308',
  },

  strengthText: {
    fontSize: 10,
    color: '#888888',
    marginLeft: 3,
  },

  inputError: {
    borderColor: '#F87171',
  },

  errorSmall: {
    color: '#EF4444',
    fontSize: 11,
    marginTop: -8,
    marginBottom: 8,
  },

  infoBlueCard: {
    backgroundColor: '#EFF6FF',
    borderRadius: 10,
    padding: 13,
    marginBottom: 14,
  },

  infoBlueTitle: {
    color: '#1D4ED8',
    fontWeight: '700',
    fontSize: 13,
    marginBottom: 6,
  },

  infoBlueText: {
    color: '#1D4ED8',
    fontSize: 12,
    lineHeight: 19,
  },

  errorBox: {
    color: '#DC2626',
    backgroundColor: '#FEF2F2',
    borderRadius: 8,
    padding: 10,
    textAlign: 'center',
    marginBottom: 8,
  },

  linkButton: {
    alignItems: 'center',
    paddingVertical: 14,
  },

  linkText: {
    color: COLORS.green,
    fontWeight: '600',
    fontSize: 13,
  },

  successCard: {
    backgroundColor: '#F0FDF4',
    borderWidth: 2,
    borderColor: '#22C55E',
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
  },

  successEmoji: {
    fontSize: 46,
    marginBottom: 8,
  },

  successTitle: {
    color: '#15803D',
    fontWeight: '700',
    fontSize: 18,
    textAlign: 'center',
    marginBottom: 8,
  },

  successText: {
    color: '#16A34A',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 19,
    marginBottom: 8,
  },

  /* HOME */

  hero: {
    alignItems: 'center',
    marginBottom: 25,
  },

  heroTitle: {
    fontSize: 31,
    fontWeight: '800',
    color: '#222222',
    marginTop: 3,
  },

  heroSubtitle: {
    fontSize: 13,
    color: '#777777',
    marginTop: 3,
  },

  welcomeTitle: {
    fontSize: 21,
    fontWeight: '800',
    color: COLORS.green,
    marginBottom: 3,
  },

  welcomeText: {
    fontSize: 14,
    color: '#666666',
    marginBottom: 15,
  },

  menuCard: {
    width: '100%',
    minHeight: 80,
    borderWidth: 2,
    borderColor: '#E5E5E5',
    borderRadius: 16,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 11,
    backgroundColor: '#FFFFFF',
  },

  menuCardHighlight: {
    borderColor: COLORS.brown,
    backgroundColor: '#FDF5F0',
  },

  menuIcon: {
    width: 50,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },

  menuText: {
    flex: 1,
  },

  menuTitle: {
    color: '#222222',
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 3,
  },

  menuTitleHighlight: {
    color: COLORS.darkBrown,
  },

  menuDescription: {
    color: '#777777',
    fontSize: 12,
    lineHeight: 17,
  },

  menuArrow: {
    color: '#CCCCCC',
    fontSize: 31,
    fontWeight: '300',
  },

  footerText: {
    textAlign: 'center',
    color: '#AAAAAA',
    fontSize: 11,
    marginTop: 25,
  },

  /* GENERAL */

  pageTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 18,
  },

  pageTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: COLORS.green,
    marginLeft: 7,
  },

  sectionHeading: {
    fontSize: 18,
    fontWeight: '800',
    color: '#333333',
    marginTop: 25,
    marginBottom: 12,
  },

  locationCard: {
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#86EFAC',
    borderRadius: 9,
    padding: 10,
    marginTop: 10,
    marginBottom: 5,
  },

  locationText: {
    color: '#15803D',
    fontSize: 13,
    marginBottom: 2,
  },

  fincaCard: {
    borderWidth: 2,
    borderColor: '#E2E2E2',
    borderRadius: 15,
    padding: 15,
    marginBottom: 12,
  },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  fincaName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#222222',
    marginLeft: 7,
  },

  coordinateText: {
    fontSize: 13,
    color: '#666666',
    marginTop: 5,
  },

  deleteButton: {
    backgroundColor: COLORS.red,
    minHeight: 43,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },

  deleteText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },

  emptyText: {
    textAlign: 'center',
    color: '#AAAAAA',
    paddingVertical: 25,
    fontSize: 13,
  },

  /* MAPA */

  mapContainer: {
    width: '100%',
    height: 360,
    borderRadius: 13,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#CDE0CD',
    backgroundColor: '#E8F4E8',
  },

  mapListCard: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 11,
    padding: 11,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },

  blueCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#3B82F6',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },

  mapListName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#333333',
  },

  mapListCoords: {
    fontSize: 10,
    color: '#777777',
    marginTop: 3,
  },

  mapFooter: {
    textAlign: 'center',
    color: '#666666',
    fontSize: 12,
    lineHeight: 18,
    marginTop: 15,
    marginBottom: 12,
  },

  /* RUTAS */

  fincaSelectCard: {
    minHeight: 50,
    borderWidth: 2,
    borderColor: '#E5E5E5',
    borderRadius: 11,
    paddingHorizontal: 12,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },

  fincaSelected: {
    borderColor: COLORS.green,
    backgroundColor: '#F0F8EE',
  },

  fincaSelectText: {
    flex: 1,
    color: '#333333',
    fontSize: 13,
    fontWeight: '600',
    marginLeft: 7,
  },

  selectedFinca: {
    marginTop: 2,
    marginBottom: 10,
  },

  selectedLabel: {
    color: '#888888',
    fontSize: 12,
    marginBottom: 4,
  },

  selectedFincaName: {
    color: COLORS.green,
    fontSize: 14,
    fontWeight: '700',
    marginLeft: 5,
  },

  recordingCard: {
    backgroundColor: '#FEF2F2',
    borderRadius: 12,
    padding: 18,
    alignItems: 'center',
    marginVertical: 10,
  },

  recordingTitle: {
    color: COLORS.green,
    fontSize: 13,
    fontWeight: '700',
  },

  gpsCounter: {
    fontSize: 50,
    fontWeight: '800',
    color: '#222222',
    marginVertical: 5,
  },

  recordingStatus: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  recordingDot: {
    width: 11,
    height: 11,
    borderRadius: 6,
    backgroundColor: '#EF4444',
    marginRight: 7,
  },

  recordingText: {
    color: '#DC2626',
    fontSize: 13,
    fontWeight: '700',
  },

  stopButton: {
    minHeight: 54,
    borderRadius: 12,
    backgroundColor: COLORS.red,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 10,
  },

  stopButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },

  routeCard: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 11,
    padding: 14,
    marginBottom: 9,
  },

  routeName: {
    color: '#222222',
    fontSize: 14,
    fontWeight: '700',
    marginLeft: 6,
  },

  routeInfo: {
    color: COLORS.green,
    fontSize: 12,
    marginTop: 6,
  },

  routeSaved: {
    color: '#777777',
    fontSize: 11,
    marginTop: 5,
  },

  /* CALIDAD */

  qualityTitle: {
    flex: 1,
    color: COLORS.darkBrown,
    fontSize: 20,
    fontWeight: '800',
    marginLeft: 7,
  },

  qualitySubtitle: {
    color: '#777777',
    fontSize: 12,
    marginTop: -10,
    marginBottom: 18,
  },

  infoCultivo: {
    backgroundColor: '#FFF8E1',
    borderWidth: 1,
    borderColor: '#F9A825',
    borderRadius: 12,
    padding: 12,
    marginBottom: 18,
  },

  infoHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  infoTitle: {
    color: '#E65100',
    fontSize: 13,
    fontWeight: '800',
    flex: 1,
  },

  infoArrow: {
    color: '#E65100',
    fontSize: 13,
  },

  infoContent: {
    marginTop: 12,
  },

  infoWhiteCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#F5E6A8',
    borderRadius: 9,
    padding: 11,
    marginBottom: 8,
  },

  infoCardTitle: {
    color: COLORS.darkBrown,
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 6,
  },

  infoItem: {
    color: '#555555',
    fontSize: 11,
    lineHeight: 17,
  },

  brownInput: {
    width: '100%',
    borderWidth: 2,
    borderColor: COLORS.brown,
    borderRadius: 11,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: '#333333',
    marginBottom: 5,
  },

  brownOptionSelected: {
    borderColor: COLORS.brown,
    backgroundColor: '#FFF8F3',
  },

  brownOptionText: {
    color: COLORS.darkBrown,
    fontWeight: '700',
  },

  validationBox: {
    borderRadius: 7,
    padding: 7,
    marginBottom: 12,
  },

  validationGreen: {
    backgroundColor: '#F0FDF4',
  },

  validationRed: {
    backgroundColor: '#FEF2F2',
  },

  validationYellow: {
    backgroundColor: '#FFFBEB',
  },

  validationText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#555555',
  },

  fermentationOption: {
    borderWidth: 2,
    borderColor: '#E0E0E0',
    borderRadius: 11,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },

  radio: {
    width: 21,
    height: 21,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: '#AAAAAA',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },

  radioSelected: {
    borderColor: COLORS.green,
  },

  radioInner: {
    width: 11,
    height: 11,
    borderRadius: 6,
    backgroundColor: COLORS.green,
  },

  fermentationTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#333333',
  },

  fermentationDescription: {
    fontSize: 11,
    color: '#777777',
    marginTop: 2,
  },

  textArea: {
    width: '100%',
    minHeight: 100,
    borderWidth: 2,
    borderColor: '#CCCCCC',
    borderRadius: 11,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 13,
    color: '#333333',
    backgroundColor: '#FFFFFF',
    marginBottom: 10,
  },

  brownButton: {
    minHeight: 54,
    borderRadius: 12,
    backgroundColor: COLORS.darkBrown,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 5,
  },

  successSmall: {
    backgroundColor: '#F0FDF4',
    borderWidth: 2,
    borderColor: '#22C55E',
    borderRadius: 10,
    padding: 11,
    marginBottom: 8,
  },

  successSmallText: {
    color: '#15803D',
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '700',
  },

  qualityCard: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 11,
    padding: 13,
    marginBottom: 10,
  },

  qualityHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },

  qualityFinca: {
    color: '#333333',
    fontSize: 12,
    fontWeight: '700',
    marginLeft: 4,
  },

  dateText: {
    color: '#AAAAAA',
    fontSize: 10,
    marginTop: 3,
  },

  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },

  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    marginRight: 5,
  },

  statusText: {
    fontSize: 10,
    fontWeight: '700',
  },

  metricsRow: {
    flexDirection: 'row',
    gap: 7,
  },

  metric: {
    flex: 1,
    borderRadius: 8,
    padding: 8,
    alignItems: 'center',
  },

  metricLabel: {
    fontSize: 9,
    color: '#666666',
  },

  metricValue: {
    fontSize: 12,
    fontWeight: '800',
    color: '#333333',
    marginTop: 3,
  },

  observation: {
    color: '#777777',
    fontSize: 11,
    fontStyle: 'italic',
    marginTop: 8,
  },
});