// Translation dictionary for English and Spanish
export type Language = "en" | "es";

export const translations = {
  en: {
    // Navigation
    home: "Home",
    stats: "Statistics",
    news: "Immigration News",
    guides: "Guides",
    help: "Help",
    settings: "Settings",
    login: "Sign In",
    signup: "Sign Up",
    
    // Common
    loading: "Loading...",
    save: "Save",
    cancel: "Cancel",
    edit: "Edit",
    delete: "Delete",
    close: "Close",
    back: "Back",
    next: "Next",
    done: "Done",
    search: "Search",
    filter: "Filter",
    
    // Auth
    email: "Email address",
    password: "Password",
    confirmPassword: "Confirm Password",
    forgotPassword: "Forgot password?",
    rememberMe: "Remember me",
    signInWithGoogle: "Continue with Google",
    signInWithApple: "Continue with Apple",
    orContinueWithEmail: "Or continue with email",
    dontHaveAccount: "Don't have an account?",
    alreadyHaveAccount: "Already have an account?",
    signingIn: "Signing in...",
    creatingAccount: "Creating account...",
    createAccount: "Create Account",
    signUp: "Sign up",
    signIn: "Sign In",
    
    // Home
    myCase: "My Case",
    trackYourCase: "Know where you stand. Track your case status and progress.",
    caseStatus: "Case Status",
    liveStatus: "Live Status",
    timeline: "Timeline",
    queuePosition: "Queue Position",
    processingTimes: "Processing Times",
    dailyApprovals: "Daily Approvals",
    
    // Settings
    account: "Account",
    profile: "Profile",
    preferences: "Preferences",
    notifications: "Notifications",
    language: "Language",
    darkMode: "Dark Mode",
    signOut: "Sign Out",
    manageYourAccount: "Manage your account information and preferences",
    customizeYourExperience: "Customize your experience and notification settings",
    getUpdatesAboutCase: "Get updates about your case status and important milestones",
    calendarSync: "Calendar Sync",
    automaticallyAddMilestones: "Automatically add important milestones to your calendar",
    
    // Help
    helpCenter: "Help Center",
    getStepByStepGuidance: "Get step-by-step guidance for your immigration journey",
    faq: "FAQs",
    interviewPrep: "Interview Preparation",
    documents: "Documents & Sponsors",
    
    // Profile
    editProfile: "Edit Profile",
    formType: "Form Type",
    priorityDate: "Priority Date",
    country: "Country",
    serviceCenter: "Service Center",
    
    // Stats
    systemHealth: "System Health",
    yourRisk: "Your Risk",
    todaysUpdate: "Today's Update",
    weeklyBreakdown: "Weekly Approval Breakdown",
    approvalTrends: "Approval Trends",
    processingTime: "Processing Time",
    
    // General
    viewMore: "View More",
    seeDetails: "See Details",
    noDataAvailable: "No data available",
    error: "Error",
    success: "Success",
    tryAgain: "Try Again",
    termsOfService: "Terms of Service",
    privacyPolicy: "Privacy Policy",
    byContinuing: "By continuing, you agree to VisaNova's",
  },
  es: {
    // Navigation
    home: "Inicio",
    stats: "Estadísticas",
    news: "Noticias de Inmigración",
    guides: "Guías",
    help: "Ayuda",
    settings: "Configuración",
    login: "Iniciar Sesión",
    signup: "Registrarse",
    
    // Common
    loading: "Cargando...",
    save: "Guardar",
    cancel: "Cancelar",
    edit: "Editar",
    delete: "Eliminar",
    close: "Cerrar",
    back: "Atrás",
    next: "Siguiente",
    done: "Hecho",
    search: "Buscar",
    filter: "Filtrar",
    
    // Auth
    email: "Correo electrónico",
    password: "Contraseña",
    confirmPassword: "Confirmar Contraseña",
    forgotPassword: "¿Olvidaste tu contraseña?",
    rememberMe: "Recordarme",
    signInWithGoogle: "Continuar con Google",
    signInWithApple: "Continuar con Apple",
    orContinueWithEmail: "O continúa con correo electrónico",
    dontHaveAccount: "¿No tienes una cuenta?",
    alreadyHaveAccount: "¿Ya tienes una cuenta?",
    signingIn: "Iniciando sesión...",
    creatingAccount: "Creando cuenta...",
    createAccount: "Crear Cuenta",
    signUp: "Registrarse",
    signIn: "Iniciar Sesión",
    
    // Home
    myCase: "Mi Caso",
    trackYourCase: "Rastrea el estado y progreso de tu caso de inmigración",
    caseStatus: "Estado del Caso",
    liveStatus: "Estado en Vivo",
    timeline: "Cronograma",
    queuePosition: "Posición en Cola",
    processingTimes: "Tiempos de Procesamiento",
    dailyApprovals: "Aprobaciones Diarias",
    
    // Settings
    account: "Cuenta",
    profile: "Perfil",
    preferences: "Preferencias",
    notifications: "Notificaciones",
    language: "Idioma",
    darkMode: "Modo Oscuro",
    signOut: "Cerrar Sesión",
    manageYourAccount: "Administra la información de tu cuenta y preferencias",
    customizeYourExperience: "Personaliza tu experiencia y configuración de notificaciones",
    getUpdatesAboutCase: "Recibe actualizaciones sobre el estado de tu caso y hitos importantes",
    calendarSync: "Sincronización de Calendario",
    automaticallyAddMilestones: "Agregar automáticamente hitos importantes a tu calendario",
    
    // Help
    helpCenter: "Centro de Ayuda",
    getStepByStepGuidance: "Obtén orientación paso a paso para tu proceso de inmigración",
    faq: "Preguntas Frecuentes",
    interviewPrep: "Preparación para Entrevista",
    documents: "Documentos y Patrocinadores",
    
    // Profile
    editProfile: "Editar Perfil",
    formType: "Tipo de Formulario",
    priorityDate: "Fecha de Prioridad",
    country: "País",
    serviceCenter: "Centro de Servicio",
    
    // Stats
    systemHealth: "Salud del Sistema",
    yourRisk: "Tu Riesgo",
    todaysUpdate: "Actualización de Hoy",
    weeklyBreakdown: "Desglose Semanal de Aprobaciones",
    approvalTrends: "Tendencias de Aprobación",
    processingTime: "Tiempo de Procesamiento",
    
    // General
    viewMore: "Ver Más",
    seeDetails: "Ver Detalles",
    noDataAvailable: "No hay datos disponibles",
    error: "Error",
    success: "Éxito",
    tryAgain: "Intentar de Nuevo",
    termsOfService: "Términos de Servicio",
    privacyPolicy: "Política de Privacidad",
    byContinuing: "Al continuar, aceptas los",
  },
} as const;

export type TranslationKey = keyof typeof translations.en;
