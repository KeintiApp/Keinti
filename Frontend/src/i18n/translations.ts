export const SUPPORTED_LANGUAGES = ['es', 'en', 'fr', 'pt'] as const;

export type Language = (typeof SUPPORTED_LANGUAGES)[number];

export type TranslationKey =
  | 'language.label'
  | 'language.spanish'
  | 'language.english'
  | 'language.french'
  | 'language.portuguese'
  | 'gender.male'
  | 'gender.female'
  | 'gender.unspecified'
  | 'common.loading'
  | 'common.logout'
  | 'common.notifications'
  | 'common.or'
  | 'common.unlock'
  | 'common.forgotPassword'
  | 'common.cancel'
  | 'common.confirm'
  | 'common.delete'
  | 'common.report'
  | 'common.block'
  | 'common.check'
  | 'common.apply'
  | 'common.accept'
  | 'common.create'

  | 'auth.sessionRequiredTitle'
  | 'auth.signInToBlockUsers'
  | 'auth.signInToReportUsers'

  | 'home.blockConfirmQuestion'
  | 'home.blockReasonPlaceholder'
  | 'home.reportSelectReason'

  | 'report.reason.sexualContent'
  | 'report.reason.harassment'
  | 'report.reason.offensiveLanguage'
  | 'report.reason.scam'
  | 'report.reason.violence'
  | 'report.reason.spam'
  | 'report.reason.impersonation'
  | 'report.reason.illegalContent'
  | 'report.reason.childSexualAbuse'
  | 'report.reason.weaponsOrDrugsIncitement'
  | 'report.reason.inappropriateConduct'
  | 'report.reason.other'

  | 'toast.blocked'
  | 'toast.reportSent'

  | 'errors.unableToBlockUser'
  | 'errors.unableToSendReport'

  | 'login.email'
  | 'login.password'
  | 'login.emailPlaceholder'
  | 'login.passwordPlaceholder'
  | 'login.signIn'
  | 'login.fillAllFields'
  | 'login.invalidCredentials'
  | 'login.noAccount'
  | 'login.signUp'
  | 'login.googleNotRegistered'
  | 'login.googlePkceMissing'

  | 'login.resetTitle'
  | 'login.resetSend'
  | 'login.resetVerify'
  | 'login.resetChangePassword'
  | 'login.resetEmailNotRegistered'
  | 'login.resetInvalidEmail'
  | 'login.resetCodeSent'
  | 'login.resetPasswordChanged'
  | 'login.resetCodeLabel'
  | 'login.resetNewPasswordLabel'
  | 'login.resetRepeatNewPasswordLabel'

  | 'register.email'
  | 'register.username'
  | 'register.usernameAlreadyInUse'
  | 'register.birthDate'
  | 'register.birthDatePlaceholder'
  | 'register.gender'
  | 'register.selectGender'
  | 'register.nationality'
  | 'register.password'
  | 'register.confirmPassword'
  | 'register.confirmPasswordPlaceholder'
  | 'register.next'
  | 'register.signUp'
  | 'register.registering'
  | 'register.successMessage'
  | 'register.privacyPrefix'
  | 'register.privacyPolicies'
  | 'register.privacyPolicyLink'
  | 'register.cookiesAdsPolicyLink'
  | 'register.termsConditionsLink'
  | 'register.privacySeparator1'
  | 'register.privacySeparator2'
  | 'register.privacySuffix'
  | 'register.errorTitle'
  | 'register.unableToComplete'
  | 'register.selectNationality'
  | 'register.searchCountry'
  | 'register.noCountriesFound'

  | 'register.emailVerificationTitle'
  | 'register.emailVerificationHint'
  | 'register.emailVerificationLinkHint'
  | 'register.iConfirmedEmail'
  | 'register.confirmedCheckHint'
  | 'register.code'
  | 'register.codePlaceholder'
  | 'register.timeRemaining'
  | 'register.verifyAndSignUp'
  | 'register.verifying'
  | 'register.resendCode'
  | 'register.codeExpired'
  | 'register.codeIncorrect'
  | 'register.codeInvalidInline'
  | 'register.remainingAttempts'
  | 'register.remainingAttemptsInline'
  | 'register.emailTemporarilyBlocked'
  | 'register.emailLockedInlineError'
  | 'register.emailLockedRetryInline'
  | 'register.rectificationTitle'
  | 'register.rectificationPlaceholder'
  | 'register.rectificationSend'
  | 'register.rectificationSent'
  | 'register.tryLaterOrCheckEmailExists'
  | 'register.mustVerifyEmailFirst'
  | 'register.cancelledNotice'
  | 'register.emailAlreadyInUse'
  | 'register.emailSendFailed'
  | 'register.missingProfileData'
  | 'register.signupExpiredNotice'
  | 'register.signupExpiredTitle'
  | 'register.emailLocked24h'
  | 'register.attemptsRemaining'
  | 'register.pendingConfirmation'
  | 'register.emailLockedTemp'
  | 'register.emailLockedPermanent'

  | 'validation.invalidDateFormat'
  | 'validation.invalidDate'
  | 'validation.mustBeAdult'
  | 'validation.passwordMinLength'
  | 'validation.passwordMaxLength'
  | 'validation.passwordNeedsLetter'
  | 'validation.passwordNeedsNumber'
  | 'validation.passwordNeedsSpecial'
  | 'validation.passwordsDontMatch'

  | 'front.editProfilePhoto'
  | 'front.yourSocialNetworks'
  | 'front.userPlaceholder'
  | 'front.selectCategory'
  | 'front.noPublicationsAvailable'
  | 'front.socialNetworksSingular'
  | 'front.socialNetworksPlural'
  | 'front.publish'
  | 'front.remove'
  | 'front.yourProfile'
  | 'front.yourPresentation'
  | 'front.intimacies'
  | 'front.time'
  | 'front.loadingImages'
  | 'front.profileEmptyPrimaryMessage'
  | 'front.profileEmptySecondaryMessage'
  | 'front.profileRingHintSelect'
  | 'front.profileRingHintMaxRings'
  | 'front.profileRingDelete'
  | 'front.profileRingNameLabel'
  | 'front.profileRingNameHelper'
  | 'front.profileRingDescriptionLabel'
  | 'front.profileRingLinkLabel'
  | 'front.profileRingLinkHelper'
  | 'front.profileRingLocationLabel'
  | 'front.profileRingLocationHelper'

  | 'profile.deleteContentTitle'
  | 'profile.deleteContentBody'
  | 'front.reactions'
  | 'front.deletePublicationTitle'
  | 'front.deletePublicationBody'
  | 'front.category'
  | 'front.presentationAddCarouselHint'
  | 'front.presentationTitleLabel'
  | 'front.presentationTitlePlaceholder'
  | 'front.presentationBodyLabel'
  | 'front.presentationBodyPlaceholder'
  | 'front.presentationLockedTitle'
  | 'front.presentationLockedBody'

  | 'front.selectSocialNetwork'
  | 'front.link'
  | 'front.linkMustBeFrom'

  | 'front.incorporate'
  | 'front.answerPlaceholder'
  | 'front.chooseCorrectOption'
  | 'front.addMoreSurveyOptions'
  | 'front.image'
  | 'front.text'
  | 'front.draftPlaceholder'
  | 'front.draftIntimacyPlaceholder'
  | 'front.intimaciesPublishBlocked'
  | 'front.homeSwipeTutorialHint'
  | 'front.channelLabel'

  | 'chat.tabYourChannel'
  | 'chat.tabChannel'
  | 'chat.tabJoined'
  | 'chat.tabYourGroups'
  | 'chat.tabGroups'
  | 'chat.postOnHomeToActivateChannel'
  | 'chat.noChannelsYet'
  | 'chat.createGroup'
  | 'chat.notJoinedAnyGroupYet'
  | 'chat.back'
  | 'chat.interactPlaceholder'
  | 'chat.timeExpired'
  | 'chat.remainingPrefix'
  | 'chat.hour'
  | 'chat.hours'
  | 'chat.minute'
  | 'chat.minutes'
  | 'chat.reply'
  | 'chat.limitWarningMessage'
  | 'chat.hostLimitedInteractions'
  | 'chat.selectGroup'
  | 'chat.toPrefix'
  | 'chat.request'
  | 'chat.requestPending'
  | 'chat.requestAccepted'
  | 'chat.requestBlocked'
  | 'chat.members'
  | 'chat.messageHidden'
  | 'chat.messageVisible'

  | 'chat.lockedYourGroupsMessage'
  | 'chat.lockedJoinedGroupsMessage'

  | 'groups.edit'
  | 'groups.delete'
  | 'groups.deleteConfirmTitle'
  | 'groups.deleteConfirmBody'
  | 'groups.limit'
  | 'groups.limited'
  | 'groups.expel'
  | 'groups.expelAndBlock'
  | 'groups.leaveGroup'
  | 'groups.leaveAndBlock'
  | 'groups.limitUsers'
  | 'groups.expelUsers'
  | 'groups.selectAll'
  | 'groups.deselect'
  | 'groups.noMembersToShow'

  | 'notifications.groupJoinRequestMessage'
  | 'notifications.ignore'
  | 'notifications.accept'
  | 'notifications.empty'

  | 'config.title'
  | 'config.accountCenter'
  | 'config.blockedUsers'
  | 'config.devicePermissions'
  | 'config.helpCenter'
  | 'config.information'
  | 'config.yourAccountIn'

  | 'aboutKeinti.title'
  | 'aboutKeinti.moreAboutKeinti'
  | 'aboutKeinti.body'

  | 'devicePermissions.description'
  | 'devicePermissions.galleryTitle'
  | 'devicePermissions.galleryDescription'
  | 'devicePermissions.statusGranted'
  | 'devicePermissions.statusDenied'
  | 'devicePermissions.statusUnknown'
  | 'devicePermissions.iosHint'
  | 'devicePermissions.revokeConfirmTitle'
  | 'devicePermissions.revokeConfirmBody'
  | 'devicePermissions.reEnableConfirmTitle'
  | 'devicePermissions.reEnableConfirmBody'
  | 'devicePermissions.osRequestTitle'
  | 'devicePermissions.osRequestMessage'
  | 'devicePermissions.osRequestAskLater'
  | 'devicePermissions.osRequestDeny'
  | 'devicePermissions.osRequestAllow'

  | 'verifyKeinti.objectivesTitle'
  | 'verifyKeinti.objective1'
  | 'verifyKeinti.complete'
  | 'verifyKeinti.completed'
  | 'verifyKeinti.objective2'
  | 'verifyKeinti.objective3'
  | 'verifyKeinti.objective4'
  | 'verifyKeinti.objective5'
  | 'verifyKeinti.objective6'
  | 'verifyKeinti.benefitsTitle'
  | 'verifyKeinti.benefit1'
  | 'verifyKeinti.benefit2'
  | 'verifyKeinti.benefit3'
  | 'verifyKeinti.benefit4'
  | 'verifyKeinti.tabObjectives'
  | 'verifyKeinti.tabBenefits'
  | 'verifyKeinti.importantNotice'
  | 'verifyKeinti.verifyAction'
  | 'verifyKeinti.accountVerifiedLabel'

  | 'accountCenter.title'
  | 'accountCenter.personalData'
  | 'accountCenter.securityControl'
  | 'accountCenter.changePassword'
  | 'accountCenter.adminSelfies'
  | 'accountCenter.closeAccount'
  | 'accountCenter.deleteAccount'
  | 'accountCenter.deleteAccountConfirmTitle'
  | 'accountCenter.deleteAccountConfirmBody'
  | 'accountCenter.accountDeletionPolicyLink'

  | 'personalData.title'
  | 'personalData.description'
  | 'personalData.contactInfo'
  | 'personalData.birthDate'
  | 'personalData.gender'
  | 'personalData.nationality'

  | 'securityControl.passwordAndAuth'
  | 'securityControl.passwordAndAuthDescription'
  | 'securityControl.accountAuth'
  | 'securityControl.privacyPolicy'
  | 'securityControl.cookiesAdPolicy'
  | 'securityControl.termsOfUse'
  | 'securityControl.childSafetyStandards'
  | 'securityControl.accountDeletionPolicy'
  | 'securityControl.verifyYourKeinti'

  | 'accountAuth.description'
  | 'accountAuth.step1Title'
  | 'accountAuth.step1Body'
  | 'accountAuth.step1Hint'
  | 'accountAuth.step1Action'
  | 'accountAuth.step1Pending'
  | 'accountAuth.step1Blocked'
  | 'accountAuth.refreshStatus'
  | 'accountAuth.selfieAccepted'
  | 'accountAuth.statusNotSubmitted'
  | 'accountAuth.statusPending'
  | 'accountAuth.statusAccepted'
  | 'accountAuth.statusFailed'
  | 'accountAuth.statusBlocked'
  | 'accountAuth.errorTitle'
  | 'accountAuth.selfieUploadError'
  | 'accountAuth.step2Title'
  | 'accountAuth.step2Body'
  | 'accountAuth.step2Locked'
  | 'accountAuth.step2Ready'
  | 'accountAuth.step2AlreadyEnabled'
  | 'accountAuth.generateTotp'
  | 'accountAuth.secretLabel'
  | 'accountAuth.secretHint'
  | 'accountAuth.codeLabel'
  | 'accountAuth.codePlaceholder'
  | 'accountAuth.verifyCode'
  | 'accountAuth.totpSetupError'
  | 'accountAuth.verifyError'
  | 'accountAuth.successTitle'
  | 'accountAuth.successBody'
  | 'accountAuth.completed'
  | 'accountAuth.badgeExpiresIn'

  | 'changePassword.requirements'
  | 'changePassword.currentPassword'
  | 'changePassword.currentPasswordInvalid'
  | 'changePassword.newPassword'
  | 'changePassword.repeatNewPassword'
  | 'changePassword.passwordsDontMatch'
  | 'changePassword.forgot'
  | 'changePassword.success'
  | 'changePassword.locked'
  | 'changePassword.attemptsRemaining'
  | 'changePassword.accountLocked'
  | 'changePassword.checkCompleted'
  | 'blockedUsers.title'
  | 'blockedUsers.empty'

  | 'adminSelfies.title'
  | 'adminSelfies.tabPending'
  | 'adminSelfies.tabBlocked'
  | 'adminSelfies.refresh'
  | 'adminSelfies.emptyPending'
  | 'adminSelfies.emptyBlocked'
  | 'adminSelfies.reasonPlaceholder'
  | 'adminSelfies.accept'
  | 'adminSelfies.reject'
  | 'adminSelfies.block'
  | 'adminSelfies.unblock'
  | 'blockedUsers.reasonPlaceholder'

  | 'toast.joinedChannelOf'
  | 'toast.published'
  | 'toast.publicationNotActiveHome'
  | 'toast.joinedGroupMessage'

  | 'carouselEditor.adjustImage'
  | 'carouselEditor.imageCount'
  | 'carouselEditor.processing'
  | 'carouselEditor.noPreview'
  | 'carouselEditor.editImage'
  | 'carouselEditor.errorTitle'
  | 'carouselEditor.cropErrorBody'
  | 'carouselEditor.ok';

const es: Record<TranslationKey, string> = {
  'language.label': 'Idioma',
  'language.spanish': 'Español',
  'language.english': 'Inglés',
  'language.french': 'Francés',
  'language.portuguese': 'Portugués',
  'gender.male': 'Hombre',
  'gender.female': 'Mujer',
  'gender.unspecified': 'No especificar',
  'common.loading': 'Cargando...',
  'common.logout': 'Cerrar sesión',
  'common.notifications': 'Notificaciones',
  'common.or': 'o',
  'common.unlock': 'Desbloquear',
  'common.forgotPassword': '¿Olvidaste tu [[contraseña]]?',
  'common.cancel': 'Cancelar',
  'common.confirm': 'Confirmar',
  'common.delete': 'Eliminar',
  'common.report': 'Denunciar',
  'common.block': 'Bloquear',
  'common.check': 'Comprobar',
  'common.apply': 'Aplicar',
  'common.accept': 'Aceptar',
  'common.create': 'Crear',

  'auth.sessionRequiredTitle': 'Sesión requerida',
  'auth.signInToBlockUsers': 'Inicia sesión para bloquear usuarios.',
  'auth.signInToReportUsers': 'Inicia sesión para denunciar usuarios.',

  'home.blockConfirmQuestion': '¿Quieres bloquear a {user}?',
  'home.blockReasonPlaceholder': 'Motivo del bloqueo (opcional)...',
  'home.reportSelectReason': 'Selecciona un motivo para denunciar a {user}.',

  'report.reason.sexualContent': 'Contenido sexual o desnudos',
  'report.reason.harassment': 'Acoso o bullying',
  'report.reason.offensiveLanguage': 'Lenguaje ofensivo',
  'report.reason.scam': 'Estafa o engaño',
  'report.reason.violence': 'Violencia o amenazas',
  'report.reason.spam': 'Spam',
  'report.reason.impersonation': 'Suplantación de identidad',
  'report.reason.illegalContent': 'Contenido ilegal',
  'report.reason.childSexualAbuse': 'Abuso/sexualización infantil',
  'report.reason.weaponsOrDrugsIncitement': 'Incitación al uso de armas/drogas',
  'report.reason.inappropriateConduct': 'Conducta inapropiada',
  'report.reason.other': 'Otros',

  'errors.unableToBlockUser': 'No se pudo bloquear al usuario',
  'errors.unableToSendReport': 'No se pudo enviar la denuncia',

  'login.email': 'Correo electrónico',
  'login.password': 'Contraseña',
  'login.emailPlaceholder': 'Ejemplo@correo.com',
  'login.passwordPlaceholder': 'Ingresa tu contraseña',
  'login.signIn': 'Iniciar Sesión',
  'login.fillAllFields': 'Por favor, completa todos los campos',
  'login.invalidCredentials': 'Credenciales incorrectas',
  'login.googleNotRegistered': 'Esta cuenta aún no está registrada. Regístrate antes para poder iniciar sesión con este correo electrónico',
  'login.googlePkceMissing': 'No se pudo completar el inicio de sesión con Google. Vuelve a intentarlo o regístrate en Keinti.',
  'login.noAccount': '¿No tienes una cuenta? ',
  'login.signUp': 'Regístrate',

  'login.resetTitle': 'Recuperar contraseña',
  'login.resetSend': 'Enviar',
  'login.resetVerify': 'Verificar',
  'login.resetChangePassword': 'Cambiar contraseña',
  'login.resetEmailNotRegistered': 'Este correo aún no está en uso en Keinti por ningún usuario. Regístrate.',
  'login.resetInvalidEmail': 'Correo inválido',
  'login.resetCodeSent': 'Te hemos enviado un código a tu correo.',
  'login.resetPasswordChanged': 'Contraseña actualizada. Ya puedes iniciar sesión.',
  'login.resetCodeLabel': 'Código',
  'login.resetNewPasswordLabel': 'Crear nueva contraseña',
  'login.resetRepeatNewPasswordLabel': 'Repetir nueva contraseña',

  'register.email': 'Correo electrónico',
  'register.username': '@usuario',
  'register.usernameAlreadyInUse': 'El "{username}" ya está siendo utilizado por otro usuario; prueba con otro.',
  'register.birthDate': 'Fecha de nacimiento',
  'register.birthDatePlaceholder': 'DD/MM/AAAA',
  'register.gender': 'Género',
  'register.selectGender': 'Selecciona tu género',
  'register.nationality': 'Nacionalidad',
  'register.password': 'Contraseña',
  'register.confirmPassword': 'Confirmar contraseña',
  'register.confirmPasswordPlaceholder': 'Confirma tu contraseña',
  'register.next': 'Siguiente',
  'register.signUp': 'Registrarse',
  'register.registering': 'Registrando...',
  'register.successMessage': 'Bienvenido, ya eres usuario de Keinti.',
  'register.privacyPrefix': 'Una vez te registres, quedarán aceptadas las ',
  'register.privacyPolicies': 'políticas de privacidad, las políticas de cookies y publicidad, y los términos y condiciones de uso',
  'register.privacyPolicyLink': 'políticas de privacidad',
  'register.cookiesAdsPolicyLink': 'políticas de cookies y publicidad',
  'register.termsConditionsLink': 'términos y condiciones de uso',
  'register.privacySeparator1': ', las ',
  'register.privacySeparator2': ', y los ',
  'register.privacySuffix': ' de nuestra aplicación Keinti. Para mayor seguridad, léelas antes de registrarte.',
  'register.errorTitle': 'Error al registrarse',
  'register.unableToComplete': 'No se pudo completar el registro.',
  'register.selectNationality': 'Selecciona tu nacionalidad',
  'register.searchCountry': 'Buscar país...',
  'register.noCountriesFound': 'No se encontraron países',

  'register.emailVerificationTitle': 'Verificación de email',
  'register.emailVerificationHint': 'Hemos enviado un código a',
  'register.emailVerificationLinkHint': 'Si recibes un enlace de confirmación en vez de un código, ábrelo y volverás automáticamente a Keinti para completar el registro.',
  'register.iConfirmedEmail': 'Ya confirmé el email',
  'register.confirmedCheckHint': 'Si ya abriste el enlace, vuelve a Keinti. Si no ocurre nada, espera unos segundos y pulsa de nuevo, o reenvía el email.',
  'register.code': 'Código',
  'register.codePlaceholder': 'Introduce el código',
  'register.timeRemaining': 'Tiempo restante',
  'register.verifyAndSignUp': 'Verificar y registrarse',
  'register.verifying': 'Verificando...',
  'register.resendCode': 'Reenviar email',
  'register.codeExpired': 'El código ha caducado. Solicita uno nuevo.',
  'register.codeIncorrect': 'Código incorrecto',
  'register.codeInvalidInline': 'El código introducido no es válido. Inténtelo de nuevo',
  'register.remainingAttempts': 'Intentos restantes',
  'register.remainingAttemptsInline': 'Faltan {count} intentos',
  'register.emailTemporarilyBlocked': 'Has agotado los intentos. Debes reiniciar el registro con otro correo.',
  'register.emailLockedInlineError': 'Este correo electrónico ha sido bloqueado temporalmente. Estamos revisando el correo electrónico. Envíenos una reclamación para poder reactivar su correo electrónico en Keinti.',
  'register.emailLockedRetryInline': 'Este correo electrónico ha sido bloqueado temporalmente. Prueba con otro o espera un tiempo hasta que se resuelva tu solicitud de rectificación.',
  'register.rectificationTitle': 'Rectificación',
  'register.rectificationPlaceholder': 'Describe tu rectificación (máx. 220 caracteres)',
  'register.rectificationSend': 'Enviar reclamación',
  'register.rectificationSent': 'Reclamación enviada. Revisaremos tu solicitud lo antes posible.',
  'register.tryLaterOrCheckEmailExists': 'Inténtalo más tarde o verifica que el email introducido existe',
  'register.mustVerifyEmailFirst': 'Debes verificar tu email antes de registrarte',
  'register.cancelledNotice': 'Proceso de registro anulado. En caso de querer registrar tu nueva cuenta en Keinti, vuelve a realizar el proceso de registro.',
  'register.emailAlreadyInUse': 'Este correo electrónico ya está en uso por otro usuario registrado en Keinti. Prueba con otro diferente.',
  'register.emailSendFailed': 'No hemos podido enviar el código al correo electrónico "{email}". Verifica que el correo electrónico sea válido.',
  'register.missingProfileData': 'Faltan datos del registro. Vuelve atrás y completa usuario, fecha, género y nacionalidad.',
  'register.signupExpiredNotice': 'El tiempo de verificación ha expirado. Tus datos de registro han sido eliminados. Puedes volver a intentarlo.',
  'register.signupExpiredTitle': 'Tiempo expirado',
  'register.emailLocked24h': 'Has agotado los {max} intentos de registro con este correo. No podrás volver a usarlo durante 48 horas.',
  'register.attemptsRemaining': 'Intentos restantes: {remaining} de {max}',
  'register.pendingConfirmation': 'Confirma tu email antes de que finalice el tiempo, aún está activo.',
  'register.emailLockedTemp': 'Has agotado los {max} intentos de registro con este correo. No podrás volver a usarlo durante 48 horas.',
  'register.emailLockedPermanent': 'Tu correo electrónico ha sido bloqueado permanentemente por exceder el límite de intentos de registro. Contacta con keintisoporte@gmail.com para solicitar el desbloqueo.',

  'validation.invalidDateFormat': 'Formato de fecha inválido',
  'validation.invalidDate': 'Fecha inválida',
  'validation.mustBeAdult': 'Debes ser mayor de 18 años',
  'validation.passwordMinLength': 'La contraseña debe tener al menos 10 caracteres',
  'validation.passwordMaxLength': 'La contraseña no puede superar 20 caracteres',
  'validation.passwordNeedsLetter': 'Debe contener al menos 1 letra',
  'validation.passwordNeedsNumber': 'Debe contener al menos 1 número',
  'validation.passwordNeedsSpecial': 'Debe contener al menos 1 carácter especial',
  'validation.passwordsDontMatch': 'Las contraseñas no coinciden',

  'front.editProfilePhoto': 'Editar Foto Perfil',
  'front.yourSocialNetworks': 'Tus Redes Sociales',
  'front.userPlaceholder': 'Usuario',
  'front.selectCategory': 'Selecciona una categoría',
  'front.noPublicationsAvailable': 'No hay publicaciones disponibles',
  'front.socialNetworksSingular': 'red social',
  'front.socialNetworksPlural': 'redes sociales',
  'front.publish': 'Publicar',
  'front.remove': 'Quitar (Publicado)',
  'front.yourProfile': 'Tu perfil',
  'front.yourPresentation': 'Tu presentación',
  'front.intimacies': 'Intimidades',
  'front.time': 'Tiempo',
  'front.loadingImages': 'Cargando imágenes...',

  'front.profileEmptyPrimaryMessage': "Agrega 'Tu presentación' y al menos una 'Intimidad' para publicar tu perfil",
  'front.profileEmptySecondaryMessage': 'Al publicar tu perfil, otros usuarios podrán acceder a tu canal, donde podrás compartir contenido e interactuar con ellos',
  'front.profileRingHintSelect': 'Selecciona una parte de una de las imágenes del carrusel',
  'front.profileRingHintMaxRings': 'Máximo alcanzado: 5 aros',
  'front.profileRingDelete': 'Eliminar aro',
  'front.profileRingNameLabel': 'Nombre (máximo 38 caracteres)',
  'front.profileRingNameHelper': 'Nombre del producto, empresa, usuario, canal, post, contenido, etc',
  'front.profileRingDescriptionLabel': 'Descripción (máximo 280 caracteres)',
  'front.profileRingLinkLabel': 'Enlace',
  'front.profileRingLinkHelper': 'Añade un enlace a una red social para que los usuarios tengan acceso al producto, la empresa, el usuario, el canal, el contenido, etc.',
  'front.profileRingLocationLabel': 'Ubicación',
  'front.profileRingLocationHelper': 'Añade una ubicación',

  'profile.deleteContentTitle': 'Eliminar contenido',
  'profile.deleteContentBody': '¿Estás seguro de que quieres eliminar este contenido de tu perfil?',
  'front.reactions': 'Reacciones',
  'front.deletePublicationTitle': 'Quitar publicación',
  'front.deletePublicationBody': 'Tu perfil actualmente es público para otros usuarios en la «Home»; al quitarlo, solo podrás visualizarlo tú en «Tu perfil».',
  'front.category': 'Categoría',
  'front.presentationAddCarouselHint': 'Añade hasta 3 imágenes al carrusel',
  'front.presentationTitleLabel': 'Título',
  'front.presentationTitlePlaceholder': 'Escribe un título...',
  'front.presentationBodyLabel': 'Presentación',
  'front.presentationBodyPlaceholder': 'Escribe tu presentación...',
  'front.presentationLockedTitle': 'Edición bloqueada',
  'front.presentationLockedBody': 'Tu perfil actualmente está publicado.',

  'front.selectSocialNetwork': 'Selecciona una red social',
  'front.link': 'Enlace',
  'front.linkMustBeFrom': 'El enlace debe ser de',

  'front.incorporate': 'Incorporar',
  'front.answerPlaceholder': 'Respuesta...',
  'front.chooseCorrectOption': 'Elige la opción correcta',
  'front.addMoreSurveyOptions': 'Añade más opciones en la encuesta',
  'front.image': 'Imagen',
  'front.text': 'Texto',
  'front.draftPlaceholder': 'Redacta...',
  'front.draftIntimacyPlaceholder': 'Redacta alguna intimidad...',
  'front.intimaciesPublishBlocked': "Aún no puedes publicar intimidades. Primero crea 'Tu presentación'.",
  'front.homeSwipeTutorialHint': 'Desliza para pasar a otra publicación',
  'front.channelLabel': 'Canal:',

  'chat.tabYourChannel': 'Tu canal',
  'chat.tabChannel': 'Canal',
  'chat.tabJoined': 'Unidos',
  'chat.tabYourGroups': 'Tus Grupos',
  'chat.tabGroups': 'Grupos',
  'chat.postOnHomeToActivateChannel': "Publica en la 'Home' para activar tu canal",
  'chat.noChannelsYet': 'No tienes canales aún',
  'chat.createGroup': 'Crea un grupo',
  'chat.notJoinedAnyGroupYet': 'Aún no te has unido a ningún grupo',
  'chat.back': 'Volver',
  'chat.interactPlaceholder': 'Interactúa...',
  'chat.timeExpired': 'Tiempo agotado',
  'chat.remainingPrefix': 'Falta',
  'chat.hour': 'hora',
  'chat.hours': 'horas',
  'chat.minute': 'minuto',
  'chat.minutes': 'minutos',
  'chat.reply': 'Responder',
  'chat.limitWarningMessage': 'Ya has interactuado en el canal de {user}. Espera la respuesta.',
  'chat.hostLimitedInteractions': '{user} te ha limitado las interacciones',
  'chat.selectGroup': 'Selecciona un grupo',
  'chat.toPrefix': 'Para:',
  'chat.request': 'Solicitar',
  'chat.requestPending': 'En espera',
  'chat.requestAccepted': 'Aceptada',
  'chat.requestBlocked': 'Bloqueado',
  'chat.members': 'Miembros',
  'chat.messageHidden': 'Mensaje oculto',
  'chat.messageVisible': 'Mensaje visible',

  'chat.lockedYourGroupsMessage': 'Autentica tu cuenta para poder crear tus grupos',
  'chat.lockedJoinedGroupsMessage': 'Para conectarte a los chats de los grupos a los que te has unido, autentica tu cuenta',

  'groups.edit': 'Editar',
  'groups.delete': 'Eliminar',
  'groups.deleteConfirmTitle': 'Confirmar eliminación',
  'groups.deleteConfirmBody': '¿Estás seguro que quieres eliminar este grupo? Todos los usuarios que se encuentran en este grupo serán expulsados',
  'groups.limit': 'Limitar',
  'groups.limited': 'Limitado',
  'groups.expel': 'Expulsar',
  'groups.expelAndBlock': 'Expulsar y Bloquear',
  'groups.leaveGroup': 'Salir del grupo',
  'groups.leaveAndBlock': 'Salir y Bloquear',
  'groups.limitUsers': 'Limitar usuarios',
  'groups.expelUsers': 'Expulsar usuarios',
  'groups.selectAll': 'Seleccionar todos',
  'groups.deselect': 'Deseleccionar',
  'groups.noMembersToShow': 'No hay miembros para mostrar',

  'notifications.groupJoinRequestMessage': '{user} te ha enviado una solicitud para que te unas a su grupo {group}. ¿Quieres unirte?',
  'notifications.ignore': 'Ignorar',
  'notifications.accept': 'Aceptar',
  'notifications.empty': 'No tienes notificaciones',

  'config.title': 'Configuración',
  'config.accountCenter': 'Centro de cuenta',
  'config.blockedUsers': 'Usuarios bloqueados',
  'config.devicePermissions': 'Permisos del dispositivo',
  'config.helpCenter': 'Centro de ayuda',
  'config.information': 'Acerca de Keinti',
  'config.yourAccountIn': 'Tu cuenta en',

  'aboutKeinti.title': 'Acerca de Keinti',
  'aboutKeinti.moreAboutKeinti': 'Más de Keinti',
  'aboutKeinti.body': `Para todos los usuarios de Keinti:

Keinti es una red social orientada al descubrimiento de perfiles y a la interacción directa entre personas. Nuestro propósito es ofrecer un entorno dinámico que favorezca la visibilidad de los usuarios, dentro de Keinti y como complemento a su presencia digital.

Cada usuario dispone de un perfil público compuesto por una Presentación y contenedores donde puede incorporar intimidades y aspectos personales. Esta estructura busca facilitar que otros miembros conozcan mejor su identidad, intereses y estilo. Desde la pantalla Home, la plataforma promueve la exploración continua de perfiles creados por personas de distintas partes del mundo.

Cuando un perfil resulte de interés, el usuario podrá unirse al canal general del anfitrión/publicador e interactuar mediante hilos de conversación. Adicionalmente, el publicador podrá invitar a los usuarios a unirse a sus grupos, con el fin de consolidar y ampliar su comunidad.

En cuanto al desarrollo, Keinti ha sido construido íntegramente con el apoyo de inteligencia artificial (ChatGPT, Claude Sonnet y Gemini) a través de Visual Studio Code. En Keinti se ha iniciado un proceso de búsqueda de colaboración para incorporar socios y perfiles especializados (desarrollo, diseño gráfico, entre otros), con el objetivo de reforzar de manera prioritaria la seguridad y la experiencia visual de la aplicación.

Para propuestas de colaboración, por favor contacte a: keintisoporte@gmail.com

Atentamente,
Equipo Keinti`,

  'verifyKeinti.objectivesTitle': 'Objetivos para conseguir Keinti verificado:',
  'verifyKeinti.objective1': '• Autentifica tu cuenta primero.',
  'verifyKeinti.complete': 'Completar',
  'verifyKeinti.completed': 'Completado',
  'verifyKeinti.objective2': '• Obtén 100.000 aperturas en tus publicaciones de tus intimidades',
  'verifyKeinti.objective3': '• Obtén en un mismo mes al menos 1.000 reproducciones de otros usuarios en las imágenes que compartas en los chats de "Tu canal"',
  'verifyKeinti.objective4': '• Haz que 100.000 usuarios se unan al chat de "Tu canal"',
  'verifyKeinti.objective5': '• Crea al menos un grupo en \'Tus grupos\' y haz que se unan a estos grupos al menos 200 miembros activos.',
  'verifyKeinti.objective6': '• Publica tu perfil al menos 40 veces en la “Home”.',
  'verifyKeinti.benefitsTitle': 'Beneficios por conseguir Keinti verificado:',
  'verifyKeinti.benefit1': '• Obtienes la insignia dorada.',
  'verifyKeinti.benefit2': '• Generas ingresos por cada usuario que acceda a los chats de "Tu canal."',
  'verifyKeinti.benefit3': '• Generas ingresos por cada 1.000 reproducciones de las imágenes que compartas por los chats de "Tu Canal"',
  'verifyKeinti.benefit4': '• Obtén otros privilegios futuros ofrecidos por Keinti en las próximas actualizaciones.',
  'verifyKeinti.tabObjectives': 'Objetivos',
  'verifyKeinti.tabBenefits': 'Beneficios',
  'verifyKeinti.importantNotice': 'Aviso importante',
  'verifyKeinti.verifyAction': 'Verificar',
  'verifyKeinti.accountVerifiedLabel': 'Cuenta verificada',

  'devicePermissions.description': 'Aquí puedes ver los permisos que has concedido a la app.',
  'devicePermissions.galleryTitle': 'Galería (fotos)',
  'devicePermissions.galleryDescription': 'Se usa cuando añades una imagen al avatar, la aplicas en tu presentación o la incorporas en intimidades.',
  'devicePermissions.statusGranted': 'Concedido',
  'devicePermissions.statusDenied': 'No concedido',
  'devicePermissions.statusUnknown': 'No disponible',
  'devicePermissions.iosHint': 'En iOS este permiso lo gestiona el sistema y se solicitará cuando selecciones una imagen.',
  'devicePermissions.revokeConfirmTitle': 'Quitar permisos',
  'devicePermissions.revokeConfirmBody': "¿Estás seguro de que quieres quitarle los permisos a 'Keinti' para que pueda acceder a tu galería?",
  'devicePermissions.reEnableConfirmTitle': 'Permiso de Galería',
  'devicePermissions.reEnableConfirmBody': '¿Quieres permitir que Keinti tenga acceso a tu galería?',
  'devicePermissions.osRequestTitle': 'Permiso de Galería',
  'devicePermissions.osRequestMessage': 'La aplicación necesita acceso a tu galería para seleccionar fotos.',
  'devicePermissions.osRequestAskLater': 'Preguntar después',
  'devicePermissions.osRequestDeny': 'Cancelar',
  'devicePermissions.osRequestAllow': 'Aceptar',

  'accountCenter.title': 'Centro de cuenta',
  'accountCenter.personalData': 'Datos personales',
  'accountCenter.securityControl': 'Control de Seguridad',
  'accountCenter.changePassword': 'Cambiar contraseña',
  'accountCenter.adminSelfies': 'Admin: revisar selfies',
  'accountCenter.closeAccount': 'Cerrar sesión',
  'accountCenter.deleteAccount': 'Eliminar cuenta',
  'accountCenter.deleteAccountConfirmTitle': 'Eliminar cuenta',
  'accountCenter.deleteAccountConfirmBody': '¿Seguro que quieres eliminar tu cuenta? Esta acción es irreversible y eliminará tus datos del sistema.',
  'accountCenter.accountDeletionPolicyLink': 'Ver política de eliminación de cuenta',

  'personalData.title': 'Datos personales',
  'personalData.description': 'Keinti usa esta información para verificar tu identidad y para mantener segura a la comunidad.',
  'personalData.contactInfo': 'Información de contacto',
  'personalData.birthDate': 'Fecha de nacimiento',
  'personalData.gender': 'Género',
  'personalData.nationality': 'Nacionalidad',

  'securityControl.passwordAndAuth': 'Contraseña y autenticación',
  'securityControl.passwordAndAuthDescription': 'En este apartado podrás autenticar tu perfil y cambiar tu contraseña',
  'securityControl.accountAuth': 'Autenticación de la cuenta',
  'securityControl.privacyPolicy': 'Política de privacidad',
  'securityControl.cookiesAdPolicy': 'Política de Cookies y Publicidad',
  'securityControl.termsOfUse': 'Términos y condiciones de uso',
  'securityControl.childSafetyStandards': 'Estándares de seguridad infantil',
  'securityControl.accountDeletionPolicy': 'Política de eliminación de cuenta',
  'securityControl.verifyYourKeinti': 'Verifica tu Keinti',

  'accountAuth.description': 'Para autenticar tu cuenta debes completar 2 pasos: selfie de verificación y código de Google Authenticator. La revisión del selfie puede tardar hasta 24 horas.',
  'accountAuth.step1Title': 'Paso 1: Selfie de verificación',
  'accountAuth.step1Body': 'Hazte un selfie para que el equipo pueda verificar que eres una persona real y mayor de edad.',
  'accountAuth.step1Hint': 'Asegúrate de tener buena iluminación y encuadrar tu rostro.',
  'accountAuth.step1Action': 'Hacer selfie',
  'accountAuth.step1Pending': 'En revisión…',
  'accountAuth.step1Blocked': 'Bloqueado',
  'accountAuth.refreshStatus': 'Actualizar estado',
  'accountAuth.selfieAccepted': 'Selfie aceptado',
  'accountAuth.statusNotSubmitted': 'Estado: pendiente de enviar.',
  'accountAuth.statusPending': 'Estado: en revisión (hasta 24 horas).',
  'accountAuth.statusAccepted': 'Estado: aceptado. Paso 2 disponible.',
  'accountAuth.statusFailed': 'Estado: fallido. Reintenta con mejor iluminación y encuadre.',
  'accountAuth.statusBlocked': 'Estado: bloqueado. No puedes reenviar selfies hasta que un administrador lo desbloquee.',
  'accountAuth.errorTitle': 'Error',
  'accountAuth.selfieUploadError': 'No se pudo enviar el selfie. Intenta de nuevo.',

  'accountAuth.step2Title': 'Paso 2: Google Authenticator',
  'accountAuth.step2Body': 'Configura Google Authenticator y verifica el código para finalizar la autenticación.',
  'accountAuth.step2Locked': 'Este paso se activará cuando el selfie sea aceptado.',
  'accountAuth.step2Ready': 'Listo para configurar Google Authenticator.',
  'accountAuth.step2AlreadyEnabled': 'Google Authenticator ya está activado.',
  'accountAuth.generateTotp': 'Generar configuración',
  'accountAuth.secretLabel': 'Clave secreta',
  'accountAuth.secretHint': 'Añade una cuenta en Google Authenticator con esta clave (manual). Luego introduce el código de 6 dígitos.',
  'accountAuth.codeLabel': 'Código',
  'accountAuth.codePlaceholder': '123456',
  'accountAuth.verifyCode': 'Verificar código',
  'accountAuth.totpSetupError': 'No se pudo generar la configuración.',
  'accountAuth.verifyError': 'No se pudo verificar el código.',
  'accountAuth.successTitle': 'Completado',
  'accountAuth.successBody': 'Tu cuenta ha sido autenticada y ya tienes la insignia.',
  'accountAuth.completed': 'Autenticación completada.',
  'accountAuth.badgeExpiresIn': 'La insignia se desactiva en:',

  'changePassword.requirements': 'La contraseña debe tener al menos 10 caracteres e incluir al menos un carácter especial (#!@_$€%)',
  'changePassword.currentPassword': 'Contraseña actual',
  'changePassword.currentPasswordInvalid': 'Contraseña incorrecta',
  'changePassword.newPassword': 'Contraseña nueva',
  'changePassword.repeatNewPassword': 'Repetir contraseña nueva',
  'changePassword.passwordsDontMatch': 'Las contraseñas no coinciden',
  'changePassword.forgot': '¿Olvidaste tu contraseña?',
  'changePassword.success': 'Contraseña actualizada',
  'changePassword.locked': 'Has alcanzado el máximo de intentos. Vuelve a intentarlo más tarde.',
  'changePassword.attemptsRemaining': 'Intentos restantes: {count}',
  'changePassword.accountLocked': 'Tu cuenta ha sido bloqueada. Se cerrará sesión automáticamente.',
  'changePassword.checkCompleted': 'Comprobación completada',

  'blockedUsers.title': 'Usuarios bloqueados',
  'blockedUsers.empty': 'No tienes usuarios bloqueados',

  'adminSelfies.title': 'Admin · Selfies',
  'adminSelfies.tabPending': 'Pendientes',
  'adminSelfies.tabBlocked': 'Bloqueados',
  'adminSelfies.refresh': 'Actualizar',
  'adminSelfies.emptyPending': 'No hay selfies pendientes.',
  'adminSelfies.emptyBlocked': 'No hay usuarios bloqueados.',
  'adminSelfies.reasonPlaceholder': 'Motivo (opcional)',
  'adminSelfies.accept': 'Aceptar',
  'adminSelfies.reject': 'Rechazar',
  'adminSelfies.block': 'Bloquear',
  'adminSelfies.unblock': 'Desbloquear',
  'blockedUsers.reasonPlaceholder': 'Sin motivo',

  'toast.joinedChannelOf': 'Te has unido al canal de',
  'toast.published': 'Has publicado',
  'toast.publicationNotActiveHome': "La publicación ya no está activa en la 'Home'",
  'toast.joinedGroupMessage': 'Te has unido al grupo {group} de {user}',
  'toast.blocked': 'Bloqueado',
  'toast.reportSent': 'Denuncia enviada',

  'carouselEditor.adjustImage': 'Ajusta la imagen',
  'carouselEditor.imageCount': 'Imagen {current} de {total}',
  'carouselEditor.processing': 'Procesando...',
  'carouselEditor.noPreview': 'Sin vista previa',
  'carouselEditor.editImage': 'Editar imagen',
  'carouselEditor.errorTitle': 'Error',
  'carouselEditor.cropErrorBody': 'No se pudo recortar la imagen. Por favor, intenta de nuevo.',
  'carouselEditor.ok': 'OK',
};

const en: Record<TranslationKey, string> = {
  'language.label': 'Language',
  'language.spanish': 'Spanish',
  'language.english': 'English',
  'language.french': 'French',
  'language.portuguese': 'Portuguese',
  'gender.male': 'Male',
  'gender.female': 'Female',
  'gender.unspecified': 'Prefer not to say',
  'common.loading': 'Loading...',
  'common.logout': 'Log out',
  'common.notifications': 'Notifications',
  'common.or': 'or',
  'common.unlock': 'Unblock',
  'common.forgotPassword': 'Forgot your [[password]]?',
  'common.cancel': 'Cancel',
  'common.confirm': 'Confirm',
  'common.delete': 'Delete',
  'common.report': 'Report',
  'common.block': 'Block',
  'common.check': 'Check',
  'common.apply': 'Apply',
  'common.accept': 'Accept',
  'common.create': 'Create',

  'auth.sessionRequiredTitle': 'Session required',
  'auth.signInToBlockUsers': 'Sign in to block users.',
  'auth.signInToReportUsers': 'Sign in to report users.',

  'home.blockConfirmQuestion': 'Do you want to block {user}?',
  'home.blockReasonPlaceholder': 'Block reason (optional)...',
  'home.reportSelectReason': 'Select a reason to report {user}.',

  'report.reason.sexualContent': 'Sexual content or nudity',
  'report.reason.harassment': 'Harassment or bullying',
  'report.reason.offensiveLanguage': 'Offensive language',
  'report.reason.scam': 'Scam or fraud',
  'report.reason.violence': 'Violence or threats',
  'report.reason.spam': 'Spam',
  'report.reason.impersonation': 'Impersonation',
  'report.reason.illegalContent': 'Illegal content',
  'report.reason.childSexualAbuse': 'Child sexual abuse/exploitation',
  'report.reason.weaponsOrDrugsIncitement': 'Incitement to use weapons/drugs',
  'report.reason.inappropriateConduct': 'Inappropriate conduct',
  'report.reason.other': 'Other',

  'errors.unableToBlockUser': 'Unable to block the user',
  'errors.unableToSendReport': 'Unable to send the report',

  'toast.joinedChannelOf': "You've joined the channel of",
  'toast.published': 'Posted',
  'toast.publicationNotActiveHome': 'The post is no longer active on Home',
  'toast.joinedGroupMessage': "You've joined group {group} from {user}",
  'toast.blocked': 'Blocked',
  'toast.reportSent': 'Report sent',

  'carouselEditor.adjustImage': 'Adjust image',
  'carouselEditor.imageCount': 'Image {current} of {total}',
  'carouselEditor.processing': 'Processing...',
  'carouselEditor.noPreview': 'No preview',
  'carouselEditor.editImage': 'Edit image',
  'carouselEditor.errorTitle': 'Error',
  'carouselEditor.cropErrorBody': 'Unable to crop the image. Please try again.',
  'carouselEditor.ok': 'OK',

  'login.email': 'Email',
  'login.password': 'Password',
  'login.emailPlaceholder': 'example@email.com',
  'login.passwordPlaceholder': 'Enter your password',
  'login.signIn': 'Sign in',
  'login.fillAllFields': 'Please fill in all fields',
  'login.invalidCredentials': 'Invalid credentials',
  'login.googleNotRegistered': 'This account is not registered yet. Please sign up first to be able to sign in with this email address.',
  'login.googlePkceMissing': 'Could not complete Google sign-in. Please try again.',
  'login.noAccount': "Don't have an account? ",
  'login.signUp': 'Sign up',

  'login.resetTitle': 'Reset password',
  'login.resetSend': 'Send',
  'login.resetVerify': 'Verify',
  'login.resetChangePassword': 'Change password',
  'login.resetEmailNotRegistered': 'This email is not yet used in Keinti by any user. Sign up.',
  'login.resetInvalidEmail': 'Invalid email',
  'login.resetCodeSent': 'We sent a code to your email.',
  'login.resetPasswordChanged': 'Password updated. You can sign in now.',
  'login.resetCodeLabel': 'Code',
  'login.resetNewPasswordLabel': 'Create new password',
  'login.resetRepeatNewPasswordLabel': 'Repeat new password',

  'register.email': 'Email',
  'register.username': '@username',
  'register.usernameAlreadyInUse': 'The "{username}" is already being used by another user; please try a different one.',
  'register.birthDate': 'Date of birth',
  'register.birthDatePlaceholder': 'DD/MM/YYYY',
  'register.gender': 'Gender',
  'register.selectGender': 'Select your gender',
  'register.nationality': 'Nationality',
  'register.password': 'Password',
  'register.confirmPassword': 'Confirm password',
  'register.confirmPasswordPlaceholder': 'Confirm your password',
  'register.next': 'Next',
  'register.signUp': 'Sign up',
  'register.registering': 'Signing up...',
  'register.successMessage': 'Welcome! You are now a Keinti user.',
  'register.privacyPrefix': 'By signing up, you accept the ',
  'register.privacyPolicies': 'privacy policy, cookies and ads policy, and the terms and conditions of use',
  'register.privacyPolicyLink': 'privacy policy',
  'register.cookiesAdsPolicyLink': 'cookies and ads policy',
  'register.termsConditionsLink': 'the terms and conditions of use',
  'register.privacySeparator1': ', ',
  'register.privacySeparator2': ', and ',
  'register.privacySuffix': ' of our Keinti app. For your safety, read them before signing up.',
  'register.errorTitle': 'Sign up error',
  'register.unableToComplete': 'Unable to complete sign up.',
  'register.selectNationality': 'Select your nationality',
  'register.searchCountry': 'Search country...',
  'register.noCountriesFound': 'No countries found',

  'register.emailVerificationTitle': 'Email verification',
  'register.emailVerificationHint': 'We sent a code to',
  'register.emailVerificationLinkHint': 'If you receive a confirmation link instead of a code, open it and you will return to Keinti automatically to complete signup.',
  'register.iConfirmedEmail': 'I already confirmed the email',
  'register.confirmedCheckHint': 'If you already opened the link, return to Keinti. If nothing happens, wait a few seconds and tap again, or resend the email.',
  'register.code': 'Code',
  'register.codePlaceholder': 'Enter the code',
  'register.timeRemaining': 'Time remaining',
  'register.verifyAndSignUp': 'Verify and sign up',
  'register.verifying': 'Verifying...',
  'register.resendCode': 'Resend email',
  'register.codeExpired': 'The code has expired. Request a new one.',
  'register.codeIncorrect': 'Incorrect code',
  'register.codeInvalidInline': 'The code you entered is not valid. Please try again.',
  'register.remainingAttempts': 'Remaining attempts',
  'register.remainingAttemptsInline': 'Remaining attempts: {count}',
  'register.emailTemporarilyBlocked': 'Too many attempts. Restart sign up with a different email.',
  'register.emailLockedInlineError': 'This email address has been temporarily blocked. We are reviewing it. Please send us a claim so we can reactivate your email address in Keinti.',
  'register.emailLockedRetryInline': 'This email address has been temporarily blocked. Try another one or wait until your rectification request is resolved.',
  'register.rectificationTitle': 'Rectification',
  'register.rectificationPlaceholder': 'Describe your rectification (max 220 characters)',
  'register.rectificationSend': 'Send claim',
  'register.rectificationSent': 'Claim sent. We will review your request as soon as possible.',
  'register.tryLaterOrCheckEmailExists': 'Try again later or check the email exists',
  'register.mustVerifyEmailFirst': 'You must verify your email before signing up',
  'register.cancelledNotice': 'Registration cancelled. If you want to create a new Keinti account, please start the sign up process again.',
  'register.emailAlreadyInUse': 'This email is already in use by another Keinti user. Please try a different one.',
  'register.emailSendFailed': 'We could not send the code to the email "{email}". Please verify the email address is valid.',
  'register.missingProfileData': 'Missing signup data. Go back and complete username, birth date, gender and nationality.',
  'register.signupExpiredNotice': 'Verification time expired. Your registration data has been cleared. You can try again.',
  'register.signupExpiredTitle': 'Time expired',
  'register.emailLocked24h': 'You have used all {max} signup attempts with this email. You cannot use it again for 48 hours.',
  'register.attemptsRemaining': 'Remaining attempts: {remaining} of {max}',
  'register.pendingConfirmation': 'Confirm your email before the timer runs out — it is still active.',
  'register.emailLockedTemp': 'You have used all {max} signup attempts with this email. You cannot use it again for 48 hours.',
  'register.emailLockedPermanent': 'Your email has been permanently blocked due to exceeding the signup attempt limit. Contact keintisoporte@gmail.com to request unblocking.',

  'validation.invalidDateFormat': 'Invalid date format',
  'validation.invalidDate': 'Invalid date',
  'validation.mustBeAdult': 'You must be at least 18 years old',
  'validation.passwordMinLength': 'Password must be at least 10 characters',
  'validation.passwordMaxLength': 'Password must be at most 20 characters',
  'validation.passwordNeedsLetter': 'Must include at least 1 letter',
  'validation.passwordNeedsNumber': 'Must include at least 1 number',
  'validation.passwordNeedsSpecial': 'Must include at least 1 special character',
  'validation.passwordsDontMatch': "Passwords don't match",

  'front.editProfilePhoto': 'Edit profile photo',
  'front.yourSocialNetworks': 'Your social networks',
  'front.userPlaceholder': 'User',
  'front.selectCategory': 'Select a category',
  'front.noPublicationsAvailable': 'No posts available',
  'front.socialNetworksSingular': 'social network',
  'front.socialNetworksPlural': 'social networks',
  'front.publish': 'Publish',
  'front.remove': 'Remove (Published)',
  'front.yourProfile': 'Your profile',
  'front.yourPresentation': 'Your presentation',
  'front.intimacies': 'Intimacies',
  'front.time': 'Time',
  'front.loadingImages': 'Loading images...',

  'front.profileEmptyPrimaryMessage': "Add 'Your presentation' and at least one 'Intimacy' to publish your profile",
  'front.profileEmptySecondaryMessage': 'By publishing your profile, other users will be able to access your channel, where you can share content and interact with them',
  'front.profileRingHintSelect': 'Select a part of one of the carousel images',
  'front.profileRingHintMaxRings': 'Max reached: 5 rings',
  'front.profileRingDelete': 'Delete ring',
  'front.profileRingNameLabel': 'Name (max 38 characters)',
  'front.profileRingNameHelper': 'Product, company, user, channel, content, etc',
  'front.profileRingDescriptionLabel': 'Description (max 280 characters)',
  'front.profileRingLinkLabel': 'Link',
  'front.profileRingLinkHelper': 'Add a social network link so users can access the product, company, user, channel, post, content, etc.',
  'front.profileRingLocationLabel': 'Location',
  'front.profileRingLocationHelper': 'Add a location',

  'profile.deleteContentTitle': 'Delete content',
  'profile.deleteContentBody': 'Are you sure you want to delete this content from your profile?',
  'front.reactions': 'Reactions',
  'front.deletePublicationTitle': 'Remove post',
  'front.deletePublicationBody': 'Your profile is currently public to other users on the “Home” page; if you remove it, only you will be able to view it in “Your Profile”.',
  'front.category': 'Category',
  'front.presentationAddCarouselHint': 'Add up to 3 images to the carousel',
  'front.presentationTitleLabel': 'Title',
  'front.presentationTitlePlaceholder': 'Write a title...',
  'front.presentationBodyLabel': 'Presentation',
  'front.presentationBodyPlaceholder': 'Write your presentation...',
  'front.presentationLockedTitle': 'Editing locked',
  'front.presentationLockedBody': 'Your profile is currently published.',

  'front.selectSocialNetwork': 'Select a social network',
  'front.link': 'Link',
  'front.linkMustBeFrom': 'Link must be from',

  'front.incorporate': 'Add',
  'front.answerPlaceholder': 'Answer...',
  'front.chooseCorrectOption': 'Choose the correct option',
  'front.addMoreSurveyOptions': 'Add more options to the survey',
  'front.image': 'Image',
  'front.text': 'Text',
  'front.draftPlaceholder': 'Write...',
  'front.draftIntimacyPlaceholder': 'Write an intimacy...',
  'front.intimaciesPublishBlocked': "You can't post intimacies yet. First create 'Your presentation'.",
  'front.homeSwipeTutorialHint': 'Swipe to move to another post',
  'front.channelLabel': 'Channel:',

  'chat.tabYourChannel': 'Your channel',
  'chat.tabChannel': 'Channel',
  'chat.tabJoined': 'Joined',
  'chat.tabYourGroups': 'Your groups',
  'chat.tabGroups': 'Groups',
  'chat.postOnHomeToActivateChannel': 'Post on Home to activate your channel',
  'chat.noChannelsYet': "You don't have any channels yet",
  'chat.createGroup': 'Create a group',
  'chat.notJoinedAnyGroupYet': "You haven't joined any group yet",
  'chat.back': 'Back',
  'chat.interactPlaceholder': 'Interact...',
  'chat.timeExpired': 'Time expired',
  'chat.remainingPrefix': 'Remaining',
  'chat.hour': 'hour',
  'chat.hours': 'hours',
  'chat.minute': 'minute',
  'chat.minutes': 'minutes',
  'chat.reply': 'Reply',
  'chat.limitWarningMessage': "You've already interacted in the channel of {user}. Please wait for the reply.",
  'chat.hostLimitedInteractions': '{user} has limited your interactions',
  'chat.selectGroup': 'Select a group',
  'chat.toPrefix': 'To:',
  'chat.request': 'Request',
  'chat.requestPending': 'Pending',
  'chat.requestAccepted': 'Accepted',
  'chat.requestBlocked': 'Blocked',
  'chat.members': 'Members',
  'chat.messageHidden': 'Message hidden',
  'chat.messageVisible': 'Message visible',

  'chat.lockedYourGroupsMessage': 'Authenticate your account to create your groups',
  'chat.lockedJoinedGroupsMessage': 'To connect to the chats of the groups you have joined, authenticate your account',

  'groups.edit': 'Edit',
  'groups.delete': 'Delete',
  'groups.deleteConfirmTitle': 'Confirm deletion',
  'groups.deleteConfirmBody': 'Are you sure you want to delete this group? All users in this group will be removed.',
  'groups.limit': 'Limit',
  'groups.limited': 'Limited',
  'groups.expel': 'Expel',
  'groups.expelAndBlock': 'Expel and block',
  'groups.leaveGroup': 'Leave group',
  'groups.leaveAndBlock': 'Leave and block',
  'groups.limitUsers': 'Limit users',
  'groups.expelUsers': 'Expel users',
  'groups.selectAll': 'Select all',
  'groups.deselect': 'Deselect',
  'groups.noMembersToShow': 'No members to display',

  'notifications.groupJoinRequestMessage': '{user} sent you a request to join their group {group}. Do you want to join?',
  'notifications.ignore': 'Ignore',
  'notifications.accept': 'Accept',
  'notifications.empty': "You don't have notifications",

  'config.title': 'Settings',
  'config.accountCenter': 'Account Center',
  'config.blockedUsers': 'Blocked users',
  'config.devicePermissions': 'Device permissions',
  'config.helpCenter': 'Help center',
  'config.information': 'About Keinti',
  'config.yourAccountIn': 'Your account on',

  'aboutKeinti.title': 'About Keinti',
  'aboutKeinti.moreAboutKeinti': 'More about Keinti',
  'aboutKeinti.body': `For all Keinti users:

Keinti is a social network focused on profile discovery and direct interaction between people. Our goal is to provide a dynamic environment that helps users increase their visibility—within Keinti and as a complement to their broader online presence.

Each user can build a public profile composed of a Presentation and containers where they may share personal insights and aspects of their identity. This structure is intended to help other members better understand their interests and style. From the Home screen, the platform promotes continuous exploration of profiles created by people around the world.

When a profile is of interest, users may join the host/publisher’s general channel and engage through conversation threads. Publishers may also invite users to join their groups in order to strengthen and grow their communities.

Regarding development, Keinti has been built entirely with the support of artificial intelligence (ChatGPT, Claude Sonnet, and Gemini) through Visual Studio Code. Keinti has initiated a collaboration search process to welcome partners and specialized contributors (development, graphic design, and other roles), with a primary focus on strengthening security and improving the product’s visual experience.

For collaboration proposals, please contact: keintisoporte@gmail.com

Sincerely,
Keinti Team`,

  'verifyKeinti.objectivesTitle': 'Targets to become Keinti Verified:',
  'verifyKeinti.objective1': '• Authenticate your account first.',
  'verifyKeinti.complete': 'Complete',
  'verifyKeinti.completed': 'Completed',
  'verifyKeinti.objective2': '• Get 100,000 openings on your intimacy posts',
  'verifyKeinti.objective3': '• In a single month, get at least 1,000 views from other users on the images you share in "Your channel" chats',
  'verifyKeinti.objective4': '• Get 100,000 users to join your "Your channel" chat',
  'verifyKeinti.objective5': '• Create at least one group in \'Your groups\' and have at least 200 active members join these groups.',
  'verifyKeinti.objective6': '• Publish your profile at least 40 times in the “Home”.',
  'verifyKeinti.benefitsTitle': 'Benefits of becoming Keinti Verified:',
  'verifyKeinti.benefit1': '• Get the golden badge.',
  'verifyKeinti.benefit2': '• Generate income for each user who accesses "Your channel" chats.',
  'verifyKeinti.benefit3': '• Generate income for every 1,000 views of the images you share in "Your Channel" chats',
  'verifyKeinti.benefit4': '• Get other future privileges offered by Keinti in upcoming updates.',
  'verifyKeinti.tabObjectives': 'Targets',
  'verifyKeinti.tabBenefits': 'Benefits',
  'verifyKeinti.importantNotice': 'Important notice',
  'verifyKeinti.verifyAction': 'Verify',
  'verifyKeinti.accountVerifiedLabel': 'Account verified',

  'devicePermissions.description': 'Here you can see the permissions you have granted to the app.',
  'devicePermissions.galleryTitle': 'Gallery (photos)',
  'devicePermissions.galleryDescription': 'Used when you add an image to your avatar, apply it to your presentation, or include it in intimacies.',
  'devicePermissions.statusGranted': 'Granted',
  'devicePermissions.statusDenied': 'Not granted',
  'devicePermissions.statusUnknown': 'Unavailable',
  'devicePermissions.iosHint': 'On iOS, this permission is managed by the system and will be requested when you select an image.',
  'devicePermissions.revokeConfirmTitle': 'Remove permission',
  'devicePermissions.revokeConfirmBody': "Are you sure you want to remove Keinti's permission to access your photo gallery?",
  'devicePermissions.reEnableConfirmTitle': 'Gallery permission',
  'devicePermissions.reEnableConfirmBody': 'Do you want to allow Keinti to access your photo gallery?',
  'devicePermissions.osRequestTitle': 'Gallery permission',
  'devicePermissions.osRequestMessage': 'The app needs access to your gallery to select photos.',
  'devicePermissions.osRequestAskLater': 'Ask later',
  'devicePermissions.osRequestDeny': 'Cancel',
  'devicePermissions.osRequestAllow': 'Allow',

  'accountCenter.title': 'Account Center',
  'accountCenter.personalData': 'Personal data',
  'accountCenter.securityControl': 'Security control',
  'accountCenter.changePassword': 'Change password',
  'accountCenter.adminSelfies': 'Admin: review selfies',
  'accountCenter.closeAccount': 'Log out',
  'accountCenter.deleteAccount': 'Delete account',
  'accountCenter.deleteAccountConfirmTitle': 'Delete account',
  'accountCenter.deleteAccountConfirmBody': 'Are you sure you want to delete your account? This action is irreversible and will remove your data from the system.',
  'accountCenter.accountDeletionPolicyLink': 'View account deletion policy',

  'personalData.title': 'Personal data',
  'personalData.description': 'Keinti uses this information to verify your identity and to keep the community safe.',
  'personalData.contactInfo': 'Contact information',
  'personalData.birthDate': 'Date of birth',
  'personalData.gender': 'Gender',
  'personalData.nationality': 'Nationality',

  'securityControl.passwordAndAuth': 'Password and authentication',
  'securityControl.passwordAndAuthDescription': 'In this section you can authenticate your profile and change your password.',
  'securityControl.accountAuth': 'Account authentication',
  'securityControl.privacyPolicy': 'Privacy policy',
  'securityControl.cookiesAdPolicy': 'Cookies and advertising policy',
  'securityControl.termsOfUse': 'Terms of use',
  'securityControl.childSafetyStandards': 'Child safety standards',
  'securityControl.accountDeletionPolicy': 'Account deletion policy',
  'securityControl.verifyYourKeinti': 'Verify your Keinti',

  'accountAuth.description': 'To authenticate your account you must complete 2 steps: a verification selfie and a Google Authenticator code. Selfie review can take up to 24 hours.',
  'accountAuth.step1Title': 'Step 1: Verification selfie',
  'accountAuth.step1Body': 'Take a selfie so the team can verify you are a real person and of legal age.',
  'accountAuth.step1Hint': 'Make sure you have good lighting and frame your face.',
  'accountAuth.step1Action': 'Take selfie',
  'accountAuth.step1Pending': 'Under review…',
  'accountAuth.step1Blocked': 'Blocked',
  'accountAuth.refreshStatus': 'Refresh status',
  'accountAuth.selfieAccepted': 'Selfie accepted',
  'accountAuth.statusNotSubmitted': 'Status: not submitted yet.',
  'accountAuth.statusPending': 'Status: under review (up to 24 hours).',
  'accountAuth.statusAccepted': 'Status: accepted. Step 2 available.',
  'accountAuth.statusFailed': 'Status: failed. Retry with better lighting and framing.',
  'accountAuth.statusBlocked': 'Status: blocked. You cannot submit more selfies until an admin unblocks you.',
  'accountAuth.errorTitle': 'Error',
  'accountAuth.selfieUploadError': 'Could not upload the selfie. Please try again.',

  'accountAuth.step2Title': 'Step 2: Google Authenticator',
  'accountAuth.step2Body': 'Set up Google Authenticator and verify the code to complete authentication.',
  'accountAuth.step2Locked': 'This step will be enabled once the selfie is accepted.',
  'accountAuth.step2Ready': 'Ready to set up Google Authenticator.',
  'accountAuth.step2AlreadyEnabled': 'Google Authenticator is already enabled.',
  'accountAuth.generateTotp': 'Generate setup',
  'accountAuth.secretLabel': 'Secret key',
  'accountAuth.secretHint': 'Add an account in Google Authenticator using this key (manual). Then enter the 6-digit code.',
  'accountAuth.codeLabel': 'Code',
  'accountAuth.codePlaceholder': '123456',
  'accountAuth.verifyCode': 'Verify code',
  'accountAuth.totpSetupError': 'Could not generate the setup.',
  'accountAuth.verifyError': 'Could not verify the code.',
  'accountAuth.successTitle': 'Completed',
  'accountAuth.successBody': 'Your account has been authenticated and the badge is now active.',
  'accountAuth.completed': 'Authentication completed.',
  'accountAuth.badgeExpiresIn': 'Badge expires in:',

  'changePassword.requirements': 'Password must be at least 10 characters and include at least one special character (#!@_$€%).',
  'changePassword.currentPassword': 'Current password',
  'changePassword.currentPasswordInvalid': 'Incorrect password',
  'changePassword.newPassword': 'New password',
  'changePassword.repeatNewPassword': 'Repeat new password',
  'changePassword.passwordsDontMatch': "Passwords don't match",
  'changePassword.forgot': 'Forgot your password?',
  'changePassword.success': 'Password updated',
  'changePassword.locked': 'You have reached the maximum attempts. Please try again later.',
  'changePassword.attemptsRemaining': 'Attempts remaining: {count}',
  'changePassword.accountLocked': 'Your account has been locked. You will be logged out automatically.',
  'changePassword.checkCompleted': 'Check completed',

  'blockedUsers.title': 'Blocked users',
  'blockedUsers.empty': "You don't have blocked users",

  'adminSelfies.title': 'Admin · Selfies',
  'adminSelfies.tabPending': 'Pending',
  'adminSelfies.tabBlocked': 'Blocked',
  'adminSelfies.refresh': 'Refresh',
  'adminSelfies.emptyPending': 'No pending selfies.',
  'adminSelfies.emptyBlocked': 'No blocked users.',
  'adminSelfies.reasonPlaceholder': 'Reason (optional)',
  'adminSelfies.accept': 'Accept',
  'adminSelfies.reject': 'Reject',
  'adminSelfies.block': 'Block',
  'adminSelfies.unblock': 'Unblock',
  'blockedUsers.reasonPlaceholder': 'No reason',
};

export const translations: Record<Language, Record<TranslationKey, string>> = {
  es,
  en,
  fr: {
    'language.label': 'Langue',
    'language.spanish': 'Espagnol',
    'language.english': 'Anglais',
    'language.french': 'Français',
    'language.portuguese': 'Portugais',
    'gender.male': 'Homme',
    'gender.female': 'Femme',
    'gender.unspecified': 'Préfère ne pas répondre',
    'common.loading': 'Chargement...',
    'common.logout': 'Se déconnecter',
    'common.notifications': 'Notifications',
    'common.or': 'ou',
    'common.unlock': 'Débloquer',
    'common.forgotPassword': 'Mot de [[passe oublié]] ?',
    'common.cancel': 'Annuler',
    'common.confirm': 'Confirmer',
    'common.delete': 'Supprimer',
    'common.report': 'Signaler',
    'common.block': 'Bloquer',
    'common.check': 'Vérifier',
    'common.apply': 'Appliquer',
    'common.accept': 'Accepter',
    'common.create': 'Créer',
    'auth.sessionRequiredTitle': 'Session requise',
    'auth.signInToBlockUsers': 'Connectez-vous pour bloquer des utilisateurs.',
    'auth.signInToReportUsers': 'Connectez-vous pour signaler des utilisateurs.',
    'home.blockConfirmQuestion': 'Voulez-vous bloquer {user} ?',
    'home.blockReasonPlaceholder': 'Motif du blocage (optionnel)...',
    'home.reportSelectReason': 'Sélectionnez un motif pour signaler {user}.',
    'report.reason.sexualContent': 'Contenu sexuel ou nudité',
    'report.reason.harassment': 'Harcèlement ou intimidation',
    'report.reason.offensiveLanguage': 'Langage offensant',
    'report.reason.scam': 'Arnaque ou fraude',
    'report.reason.violence': 'Violence ou menaces',
    'report.reason.spam': 'Spam',
    'report.reason.impersonation': 'Usurpation d’identité',
    'report.reason.illegalContent': 'Contenu illégal',
    'report.reason.childSexualAbuse': 'Abus ou exploitation sexuelle de mineurs',
    'report.reason.weaponsOrDrugsIncitement': 'Incitation à l’usage d’armes ou de drogues',
    'report.reason.inappropriateConduct': 'Comportement inapproprié',
    'report.reason.other': 'Autre',
    'toast.joinedChannelOf': 'Vous avez rejoint le canal de',
    'toast.published': 'Publié',
    'toast.publicationNotActiveHome': 'La publication n’est plus active sur Accueil',
    'toast.joinedGroupMessage': 'Vous avez rejoint le groupe {group} de {user}',
    'toast.blocked': 'Bloqué',
    'toast.reportSent': 'Signalement envoyé',
    'carouselEditor.adjustImage': 'Ajuster l’image',
    'carouselEditor.imageCount': 'Image {current} sur {total}',
    'carouselEditor.processing': 'Traitement...',
    'carouselEditor.noPreview': 'Aucun aperçu',
    'carouselEditor.editImage': 'Modifier l’image',
    'carouselEditor.errorTitle': 'Erreur',
    'carouselEditor.cropErrorBody': 'Impossible de recadrer l’image. Veuillez réessayer.',
    'carouselEditor.ok': 'OK',
    'errors.unableToBlockUser': 'Impossible de bloquer l’utilisateur',
    'errors.unableToSendReport': 'Impossible d’envoyer le signalement',
    'login.email': 'E-mail',
    'login.password': 'Mot de passe',
    'login.emailPlaceholder': 'exemple@email.com',
    'login.passwordPlaceholder': 'Entrez votre mot de passe',
    'login.signIn': 'Se connecter',
    'login.fillAllFields': 'Veuillez remplir tous les champs',
    'login.invalidCredentials': 'Identifiants invalides',
    'login.noAccount': 'Vous n’avez pas de compte ? ',
    'login.signUp': 'S’inscrire',
    'login.googleNotRegistered': 'Ce compte n’est pas encore enregistré. Inscrivez-vous d’abord pour pouvoir vous connecter avec cette adresse e-mail.',
    'login.googlePkceMissing': 'Impossible de finaliser la connexion Google. Veuillez réessayer.',
    'login.resetTitle': 'Réinitialiser le mot de passe',
    'login.resetSend': 'Envoyer',
    'login.resetVerify': 'Vérifier',
    'login.resetChangePassword': 'Changer le mot de passe',
    'login.resetEmailNotRegistered': 'Cette adresse e-mail n’est pas encore utilisée sur Keinti. Inscrivez-vous.',
    'login.resetInvalidEmail': 'E-mail invalide',
    'login.resetCodeSent': 'Nous avons envoyé un code à votre e-mail.',
    'login.resetPasswordChanged': 'Mot de passe mis à jour. Vous pouvez maintenant vous connecter.',
    'login.resetCodeLabel': 'Code',
    'login.resetNewPasswordLabel': 'Créer un nouveau mot de passe',
    'login.resetRepeatNewPasswordLabel': 'Répéter le nouveau mot de passe',
    'register.email': 'E-mail',
    'register.username': '@nomutilisateur',
    'register.usernameAlreadyInUse': '« {username} » est déjà utilisé par un autre utilisateur ; veuillez en essayer un autre.',
    'register.birthDate': 'Date de naissance',
    'register.birthDatePlaceholder': 'JJ/MM/AAAA',
    'register.gender': 'Genre',
    'register.selectGender': 'Sélectionnez votre genre',
    'register.nationality': 'Nationalité',
    'register.password': 'Mot de passe',
    'register.confirmPassword': 'Confirmer le mot de passe',
    'register.confirmPasswordPlaceholder': 'Confirmez votre mot de passe',
    'register.next': 'Suivant',
    'register.signUp': 'S’inscrire',
    'register.registering': 'Inscription...',
    'register.successMessage': 'Bienvenue ! Vous êtes désormais un utilisateur de Keinti.',
    'register.privacyPrefix': 'En vous inscrivant, vous acceptez la ',
    'register.privacyPolicies': 'politique de confidentialité, la politique de cookies et publicité, ainsi que les conditions d’utilisation',
    'register.privacyPolicyLink': 'politique de confidentialité',
    'register.cookiesAdsPolicyLink': 'politique de cookies et publicité',
    'register.termsConditionsLink': 'conditions d’utilisation',
    'register.privacySeparator1': ', ',
    'register.privacySeparator2': ', et ',
    'register.privacySuffix': ' de notre application Keinti. Pour votre sécurité, lisez-les avant de vous inscrire.',
    'register.errorTitle': 'Erreur d’inscription',
    'register.unableToComplete': 'Impossible de terminer l’inscription.',
    'register.selectNationality': 'Sélectionnez votre nationalité',
    'register.searchCountry': 'Rechercher un pays...',
    'register.noCountriesFound': 'Aucun pays trouvé',
    'register.emailVerificationTitle': 'Vérification de l’e-mail',
    'register.emailVerificationHint': 'Nous avons envoyé un code à',
    'register.emailVerificationLinkHint': 'Si vous recevez un lien de confirmation au lieu d’un code, ouvrez-le et vous reviendrez automatiquement dans Keinti pour terminer l’inscription.',
    'register.iConfirmedEmail': 'J’ai déjà confirmé l’e-mail',
    'register.confirmedCheckHint': 'Si vous avez déjà ouvert le lien, revenez dans Keinti. Si rien ne se passe, attendez quelques secondes puis appuyez de nouveau, ou renvoyez l’e-mail.',
    'register.code': 'Code',
    'register.codePlaceholder': 'Entrez le code',
    'register.timeRemaining': 'Temps restant',
    'register.verifyAndSignUp': 'Vérifier et s’inscrire',
    'register.verifying': 'Vérification...',
    'register.resendCode': 'Renvoyer l’e-mail',
    'register.codeExpired': 'Le code a expiré. Demandez-en un nouveau.',
    'register.codeIncorrect': 'Code incorrect',
    'register.codeInvalidInline': 'Le code saisi n’est pas valide. Veuillez réessayer.',
    'register.remainingAttempts': 'Tentatives restantes',
    'register.remainingAttemptsInline': 'Tentatives restantes : {count}',
    'register.emailTemporarilyBlocked': 'Trop de tentatives. Recommencez l’inscription avec une autre adresse e-mail.',
    'register.emailLockedInlineError': 'Cette adresse e-mail a été temporairement bloquée. Nous l’examinons. Veuillez nous envoyer une réclamation afin que nous puissions la réactiver dans Keinti.',
    'register.emailLockedRetryInline': 'Cette adresse e-mail a été temporairement bloquée. Essayez-en une autre ou attendez la résolution de votre demande de rectification.',
    'register.rectificationTitle': 'Rectification',
    'register.rectificationPlaceholder': 'Décrivez votre rectification (max. 220 caractères)',
    'register.rectificationSend': 'Envoyer la réclamation',
    'register.rectificationSent': 'Réclamation envoyée. Nous examinerons votre demande dès que possible.',
    'register.tryLaterOrCheckEmailExists': 'Réessayez plus tard ou vérifiez que l’e-mail existe',
    'register.mustVerifyEmailFirst': 'Vous devez vérifier votre e-mail avant de vous inscrire',
    'register.cancelledNotice': 'Inscription annulée. Si vous souhaitez créer un nouveau compte Keinti, veuillez recommencer la procédure d’inscription.',
    'register.emailAlreadyInUse': 'Cette adresse e-mail est déjà utilisée par un autre utilisateur Keinti. Veuillez en essayer une autre.',
    'register.emailSendFailed': 'Nous n’avons pas pu envoyer le code à l’adresse e-mail « {email} ». Veuillez vérifier que cette adresse est valide.',
    'register.missingProfileData': 'Données d’inscription manquantes. Revenez en arrière et complétez le nom d’utilisateur, la date de naissance, le genre et la nationalité.',
    'register.signupExpiredNotice': 'Le délai de vérification a expiré. Vos données d’inscription ont été effacées. Vous pouvez réessayer.',
    'register.signupExpiredTitle': 'Temps écoulé',
    'register.emailLocked24h': 'Vous avez utilisé les {max} tentatives d’inscription avec cet e-mail. Vous ne pourrez plus l’utiliser pendant 48 heures.',
    'register.attemptsRemaining': 'Tentatives restantes : {remaining} sur {max}',
    'register.pendingConfirmation': 'Confirmez votre e-mail avant que le minuteur n’expire : il est encore actif.',
    'register.emailLockedTemp': 'Vous avez utilisé les {max} tentatives d’inscription avec cet e-mail. Vous ne pourrez plus l’utiliser pendant 48 heures.',
    'register.emailLockedPermanent': 'Votre adresse e-mail a été bloquée définitivement pour dépassement de la limite de tentatives d’inscription. Contactez keintisoporte@gmail.com pour demander son déblocage.',
    'validation.invalidDateFormat': 'Format de date invalide',
    'validation.invalidDate': 'Date invalide',
    'validation.mustBeAdult': 'Vous devez avoir au moins 18 ans',
    'validation.passwordMinLength': 'Le mot de passe doit contenir au moins 10 caractères',
    'validation.passwordMaxLength': 'Le mot de passe doit contenir au maximum 20 caractères',
    'validation.passwordNeedsLetter': 'Doit inclure au moins 1 lettre',
    'validation.passwordNeedsNumber': 'Doit inclure au moins 1 chiffre',
    'validation.passwordNeedsSpecial': 'Doit inclure au moins 1 caractère spécial',
    'validation.passwordsDontMatch': 'Les mots de passe ne correspondent pas',
    'front.editProfilePhoto': 'Modifier la photo de profil',
    'front.yourSocialNetworks': 'Vos réseaux sociaux',
    'front.userPlaceholder': 'Utilisateur',
    'front.selectCategory': 'Sélectionnez une catégorie',
    'front.noPublicationsAvailable': 'Aucune publication disponible',
    'front.socialNetworksSingular': 'réseau social',
    'front.socialNetworksPlural': 'réseaux sociaux',
    'front.publish': 'Publier',
    'front.remove': 'Retirer (publié)',
    'front.yourProfile': 'Votre profil',
    'front.yourPresentation': 'Votre présentation',
    'front.intimacies': 'Intimités',
    'front.time': 'Temps',
    'front.loadingImages': 'Chargement des images...',
    'front.profileEmptyPrimaryMessage': 'Ajoutez « Votre présentation » et au moins une « Intimité » pour publier votre profil',
    'front.profileEmptySecondaryMessage': 'En publiant votre profil, d’autres utilisateurs pourront accéder à votre canal, où vous pourrez partager du contenu et interagir avec eux',
    'front.profileRingHintSelect': 'Sélectionnez une partie d’une des images du carrousel',
    'front.profileRingHintMaxRings': 'Maximum atteint : 5 anneaux',
    'front.profileRingDelete': 'Supprimer l’anneau',
    'front.profileRingNameLabel': 'Nom (max. 38 caractères)',
    'front.profileRingNameHelper': 'Produit, entreprise, utilisateur, canal, contenu, etc.',
    'front.profileRingDescriptionLabel': 'Description (max. 280 caractères)',
    'front.profileRingLinkLabel': 'Lien',
    'front.profileRingLinkHelper': 'Ajoutez un lien de réseau social pour que les utilisateurs puissent accéder au produit, à l’entreprise, à l’utilisateur, au canal, à la publication, au contenu, etc.',
    'front.profileRingLocationLabel': 'Lieu',
    'front.profileRingLocationHelper': 'Ajouter un lieu',
    'profile.deleteContentTitle': 'Supprimer le contenu',
    'profile.deleteContentBody': 'Voulez-vous vraiment supprimer ce contenu de votre profil ?',
    'front.reactions': 'Réactions',
    'front.deletePublicationTitle': 'Retirer la publication',
    'front.deletePublicationBody': 'Votre profil est actuellement public pour les autres utilisateurs sur la page « Accueil » ; si vous le retirez, vous seul pourrez le voir dans « Votre profil ».',
    'front.category': 'Catégorie',
    'front.presentationAddCarouselHint': 'Ajoutez jusqu’à 3 images au carrousel',
    'front.presentationTitleLabel': 'Titre',
    'front.presentationTitlePlaceholder': 'Écrivez un titre...',
    'front.presentationBodyLabel': 'Présentation',
    'front.presentationBodyPlaceholder': 'Écrivez votre présentation...',
    'front.presentationLockedTitle': 'Modification verrouillée',
    'front.presentationLockedBody': 'Votre profil est actuellement publié.',
    'front.selectSocialNetwork': 'Sélectionnez un réseau social',
    'front.link': 'Lien',
    'front.linkMustBeFrom': 'Le lien doit provenir de',
    'front.incorporate': 'Ajouter',
    'front.answerPlaceholder': 'Réponse...',
    'front.chooseCorrectOption': 'Choisissez la bonne option',
    'front.addMoreSurveyOptions': 'Ajouter plus d’options au sondage',
    'front.image': 'Image',
    'front.text': 'Texte',
    'front.draftPlaceholder': 'Écrire...',
    'front.draftIntimacyPlaceholder': 'Écrivez une intimité...',
    'front.intimaciesPublishBlocked': 'Vous ne pouvez pas encore publier d’intimités. Créez d’abord « Votre présentation ».',
    'front.homeSwipeTutorialHint': 'Balayez pour passer à une autre publication',
    'front.channelLabel': 'Canal :',
    'chat.tabYourChannel': 'Votre canal',
    'chat.tabChannel': 'Canal',
    'chat.tabJoined': 'Rejoints',
    'chat.tabYourGroups': 'Vos groupes',
    'chat.tabGroups': 'Groupes',
    'chat.postOnHomeToActivateChannel': 'Publiez sur Accueil pour activer votre canal',
    'chat.noChannelsYet': 'Vous n’avez encore aucun canal',
    'chat.createGroup': 'Créer un groupe',
    'chat.notJoinedAnyGroupYet': 'Vous n’avez encore rejoint aucun groupe',
    'chat.back': 'Retour',
    'chat.interactPlaceholder': 'Interagir...',
    'chat.timeExpired': 'Temps écoulé',
    'chat.remainingPrefix': 'Reste',
    'chat.hour': 'heure',
    'chat.hours': 'heures',
    'chat.minute': 'minute',
    'chat.minutes': 'minutes',
    'chat.reply': 'Répondre',
    'chat.limitWarningMessage': 'Vous avez déjà interagi dans le canal de {user}. Veuillez attendre la réponse.',
    'chat.hostLimitedInteractions': '{user} a limité vos interactions',
    'chat.selectGroup': 'Sélectionnez un groupe',
    'chat.toPrefix': 'À :',
    'chat.request': 'Demande',
    'chat.requestPending': 'En attente',
    'chat.requestAccepted': 'Acceptée',
    'chat.requestBlocked': 'Bloquée',
    'chat.members': 'Membres',
    'chat.messageHidden': 'Message masqué',
    'chat.messageVisible': 'Message visible',
    'chat.lockedYourGroupsMessage': 'Authentifiez votre compte pour créer vos groupes',
    'chat.lockedJoinedGroupsMessage': 'Pour accéder aux chats des groupes que vous avez rejoints, authentifiez votre compte',
    'groups.edit': 'Modifier',
    'groups.delete': 'Supprimer',
    'groups.deleteConfirmTitle': 'Confirmer la suppression',
    'groups.deleteConfirmBody': 'Voulez-vous vraiment supprimer ce groupe ? Tous les utilisateurs de ce groupe seront retirés.',
    'groups.limit': 'Limiter',
    'groups.limited': 'Limité',
    'groups.expel': 'Expulser',
    'groups.expelAndBlock': 'Expulser et bloquer',
    'groups.leaveGroup': 'Quitter le groupe',
    'groups.leaveAndBlock': 'Quitter et bloquer',
    'groups.limitUsers': 'Limiter des utilisateurs',
    'groups.expelUsers': 'Expulser des utilisateurs',
    'groups.selectAll': 'Tout sélectionner',
    'groups.deselect': 'Désélectionner',
    'groups.noMembersToShow': 'Aucun membre à afficher',
    'notifications.groupJoinRequestMessage': '{user} vous a envoyé une demande pour rejoindre son groupe {group}. Voulez-vous le rejoindre ?',
    'notifications.ignore': 'Ignorer',
    'notifications.accept': 'Accepter',
    'notifications.empty': 'Vous n’avez pas de notifications',
    'config.title': 'Paramètres',
    'config.accountCenter': 'Centre de compte',
    'config.blockedUsers': 'Utilisateurs bloqués',
    'config.devicePermissions': 'Autorisations de l’appareil',
    'config.helpCenter': 'Centre d’aide',
    'config.information': 'À propos de Keinti',
    'config.yourAccountIn': 'Votre compte sur',
    'aboutKeinti.title': 'À propos de Keinti',
    'aboutKeinti.moreAboutKeinti': 'En savoir plus sur Keinti',
    'aboutKeinti.body': `À tous les utilisateurs de Keinti :

Keinti est un réseau social axé sur la découverte de profils et l’interaction directe entre les personnes. Notre objectif est d’offrir un environnement dynamique qui aide les utilisateurs à accroître leur visibilité, au sein de Keinti et en complément de leur présence en ligne.

Chaque utilisateur peut créer un profil public composé d’une Présentation et d’espaces où il peut partager des réflexions personnelles et des aspects de son identité. Cette structure vise à aider les autres membres à mieux comprendre leurs intérêts et leur style. Depuis l’écran Accueil, la plateforme encourage une exploration continue des profils créés par des personnes du monde entier.

Lorsqu’un profil suscite de l’intérêt, les utilisateurs peuvent rejoindre le canal général de l’hôte ou de l’auteur et interagir par le biais de fils de conversation. Les auteurs peuvent également inviter des utilisateurs à rejoindre leurs groupes afin de renforcer et de développer leurs communautés.

Concernant le développement, Keinti a été entièrement construit avec le soutien de l’intelligence artificielle (ChatGPT, Claude Sonnet et Gemini) via Visual Studio Code. Keinti a entamé un processus de recherche de collaboration afin d’accueillir des partenaires et des contributeurs spécialisés (développement, design graphique et autres rôles), avec comme priorité le renforcement de la sécurité et l’amélioration de l’expérience visuelle du produit.

Pour les propositions de collaboration, veuillez contacter : keintisoporte@gmail.com

Cordialement,
L’équipe Keinti`,
    'verifyKeinti.objectivesTitle': 'Objectifs pour devenir Keinti Verified :',
    'verifyKeinti.objective1': '• Authentifiez d’abord votre compte.',
    'verifyKeinti.complete': 'Compléter',
    'verifyKeinti.completed': 'Terminé',
    'verifyKeinti.objective2': '• Obtenez 100 000 ouvertures sur vos publications d’intimités',
    'verifyKeinti.objective3': '• En un seul mois, obtenez au moins 1 000 vues d’autres utilisateurs sur les images que vous partagez dans les chats de « Votre canal »',
    'verifyKeinti.objective4': '• Faites rejoindre 100 000 utilisateurs au chat de « Votre canal »',
    'verifyKeinti.objective5': '• Créez au moins un groupe dans « Vos groupes » et faites en sorte qu’au moins 200 membres actifs rejoignent ces groupes.',
    'verifyKeinti.objective6': '• Publiez votre profil au moins 40 fois sur « Accueil ».',
    'verifyKeinti.benefitsTitle': 'Avantages de devenir Keinti Verified :',
    'verifyKeinti.benefit1': '• Obtenez le badge doré.',
    'verifyKeinti.benefit2': '• Générez des revenus pour chaque utilisateur qui accède aux chats de « Votre canal ».',
    'verifyKeinti.benefit3': '• Générez des revenus pour chaque tranche de 1 000 vues des images que vous partagez dans les chats de « Votre canal »',
    'verifyKeinti.benefit4': '• Obtenez d’autres privilèges futurs proposés par Keinti dans les prochaines mises à jour.',
    'verifyKeinti.tabObjectives': 'Objectifs',
    'verifyKeinti.tabBenefits': 'Avantages',
    'verifyKeinti.importantNotice': 'Avis important',
    'verifyKeinti.verifyAction': 'Vérifier',
    'verifyKeinti.accountVerifiedLabel': 'Compte vérifié',
    'devicePermissions.description': 'Ici, vous pouvez voir les autorisations que vous avez accordées à l’application.',
    'devicePermissions.galleryTitle': 'Galerie (photos)',
    'devicePermissions.galleryDescription': 'Utilisée lorsque vous ajoutez une image à votre avatar, à votre présentation ou à vos intimités.',
    'devicePermissions.statusGranted': 'Accordée',
    'devicePermissions.statusDenied': 'Non accordée',
    'devicePermissions.statusUnknown': 'Indisponible',
    'devicePermissions.iosHint': 'Sur iOS, cette autorisation est gérée par le système et sera demandée lorsque vous sélectionnerez une image.',
    'devicePermissions.revokeConfirmTitle': 'Retirer l’autorisation',
    'devicePermissions.revokeConfirmBody': 'Voulez-vous vraiment retirer à Keinti l’autorisation d’accéder à votre galerie photo ?',
    'devicePermissions.reEnableConfirmTitle': 'Autorisation de galerie',
    'devicePermissions.reEnableConfirmBody': 'Voulez-vous autoriser Keinti à accéder à votre galerie photo ?',
    'devicePermissions.osRequestTitle': 'Autorisation de galerie',
    'devicePermissions.osRequestMessage': 'L’application a besoin d’accéder à votre galerie pour sélectionner des photos.',
    'devicePermissions.osRequestAskLater': 'Plus tard',
    'devicePermissions.osRequestDeny': 'Annuler',
    'devicePermissions.osRequestAllow': 'Autoriser',
    'accountCenter.title': 'Centre de compte',
    'accountCenter.personalData': 'Données personnelles',
    'accountCenter.securityControl': 'Contrôle de sécurité',
    'accountCenter.changePassword': 'Changer le mot de passe',
    'accountCenter.adminSelfies': 'Admin : vérifier les selfies',
    'accountCenter.closeAccount': 'Se déconnecter',
    'accountCenter.deleteAccount': 'Supprimer le compte',
    'accountCenter.deleteAccountConfirmTitle': 'Supprimer le compte',
    'accountCenter.deleteAccountConfirmBody': 'Voulez-vous vraiment supprimer votre compte ? Cette action est irréversible et supprimera vos données du système.',
    'accountCenter.accountDeletionPolicyLink': 'Voir la politique de suppression de compte',
    'personalData.title': 'Données personnelles',
    'personalData.description': 'Keinti utilise ces informations pour vérifier votre identité et protéger la communauté.',
    'personalData.contactInfo': 'Coordonnées',
    'personalData.birthDate': 'Date de naissance',
    'personalData.gender': 'Genre',
    'personalData.nationality': 'Nationalité',
    'securityControl.passwordAndAuth': 'Mot de passe et authentification',
    'securityControl.passwordAndAuthDescription': 'Dans cette section, vous pouvez authentifier votre profil et changer votre mot de passe.',
    'securityControl.accountAuth': 'Authentification du compte',
    'securityControl.privacyPolicy': 'Politique de confidentialité',
    'securityControl.cookiesAdPolicy': 'Politique de cookies et publicité',
    'securityControl.termsOfUse': 'Conditions d’utilisation',
    'securityControl.childSafetyStandards': 'Normes de sécurité de l’enfance',
    'securityControl.accountDeletionPolicy': 'Politique de suppression de compte',
    'securityControl.verifyYourKeinti': 'Vérifiez votre Keinti',
    'accountAuth.description': 'Pour authentifier votre compte, vous devez compléter 2 étapes : un selfie de vérification et un code Google Authenticator. L’examen du selfie peut prendre jusqu’à 24 heures.',
    'accountAuth.step1Title': 'Étape 1 : selfie de vérification',
    'accountAuth.step1Body': 'Prenez un selfie afin que l’équipe puisse vérifier que vous êtes une personne réelle et majeure.',
    'accountAuth.step1Hint': 'Assurez-vous d’avoir un bon éclairage et de bien cadrer votre visage.',
    'accountAuth.step1Action': 'Prendre un selfie',
    'accountAuth.step1Pending': 'En cours d’examen…',
    'accountAuth.step1Blocked': 'Bloqué',
    'accountAuth.refreshStatus': 'Actualiser le statut',
    'accountAuth.selfieAccepted': 'Selfie accepté',
    'accountAuth.statusNotSubmitted': 'Statut : pas encore envoyé.',
    'accountAuth.statusPending': 'Statut : en cours d’examen (jusqu’à 24 heures).',
    'accountAuth.statusAccepted': 'Statut : accepté. Étape 2 disponible.',
    'accountAuth.statusFailed': 'Statut : échec. Réessayez avec un meilleur éclairage et un meilleur cadrage.',
    'accountAuth.statusBlocked': 'Statut : bloqué. Vous ne pouvez plus envoyer de selfies tant qu’un administrateur ne vous a pas débloqué.',
    'accountAuth.errorTitle': 'Erreur',
    'accountAuth.selfieUploadError': 'Impossible d’envoyer le selfie. Veuillez réessayer.',
    'accountAuth.step2Title': 'Étape 2 : Google Authenticator',
    'accountAuth.step2Body': 'Configurez Google Authenticator et vérifiez le code pour terminer l’authentification.',
    'accountAuth.step2Locked': 'Cette étape sera activée une fois le selfie accepté.',
    'accountAuth.step2Ready': 'Prêt à configurer Google Authenticator.',
    'accountAuth.step2AlreadyEnabled': 'Google Authenticator est déjà activé.',
    'accountAuth.generateTotp': 'Générer la configuration',
    'accountAuth.secretLabel': 'Clé secrète',
    'accountAuth.secretHint': 'Ajoutez un compte dans Google Authenticator en utilisant cette clé (manuel). Ensuite, entrez le code à 6 chiffres.',
    'accountAuth.codeLabel': 'Code',
    'accountAuth.codePlaceholder': '123456',
    'accountAuth.verifyCode': 'Vérifier le code',
    'accountAuth.totpSetupError': 'Impossible de générer la configuration.',
    'accountAuth.verifyError': 'Impossible de vérifier le code.',
    'accountAuth.successTitle': 'Terminé',
    'accountAuth.successBody': 'Votre compte a été authentifié et le badge est maintenant actif.',
    'accountAuth.completed': 'Authentification terminée.',
    'accountAuth.badgeExpiresIn': 'Le badge expire dans :',
    'changePassword.requirements': 'Le mot de passe doit contenir au moins 10 caractères et inclure au moins un caractère spécial (#!@_$€%).',
    'changePassword.currentPassword': 'Mot de passe actuel',
    'changePassword.currentPasswordInvalid': 'Mot de passe incorrect',
    'changePassword.newPassword': 'Nouveau mot de passe',
    'changePassword.repeatNewPassword': 'Répéter le nouveau mot de passe',
    'changePassword.passwordsDontMatch': 'Les mots de passe ne correspondent pas',
    'changePassword.forgot': 'Mot de passe oublié ?',
    'changePassword.success': 'Mot de passe mis à jour',
    'changePassword.locked': 'Vous avez atteint le nombre maximal de tentatives. Veuillez réessayer plus tard.',
    'changePassword.attemptsRemaining': 'Tentatives restantes : {count}',
    'changePassword.accountLocked': 'Votre compte a été verrouillé. Vous serez déconnecté automatiquement.',
    'changePassword.checkCompleted': 'Vérification terminée',
    'blockedUsers.title': 'Utilisateurs bloqués',
    'blockedUsers.empty': 'Vous n’avez pas d’utilisateurs bloqués',
    'adminSelfies.title': 'Admin · Selfies',
    'adminSelfies.tabPending': 'En attente',
    'adminSelfies.tabBlocked': 'Bloqués',
    'adminSelfies.refresh': 'Actualiser',
    'adminSelfies.emptyPending': 'Aucun selfie en attente.',
    'adminSelfies.emptyBlocked': 'Aucun utilisateur bloqué.',
    'adminSelfies.reasonPlaceholder': 'Motif (optionnel)',
    'adminSelfies.accept': 'Accepter',
    'adminSelfies.reject': 'Rejeter',
    'adminSelfies.block': 'Bloquer',
    'adminSelfies.unblock': 'Débloquer',
    'blockedUsers.reasonPlaceholder': 'Aucun motif',
  },
  pt: {
    'language.label': 'Idioma',
    'language.spanish': 'Espanhol',
    'language.english': 'Inglês',
    'language.french': 'Francês',
    'language.portuguese': 'Português',
    'gender.male': 'Homem',
    'gender.female': 'Mulher',
    'gender.unspecified': 'Prefiro não informar',
    'common.loading': 'Carregando...',
    'common.logout': 'Sair',
    'common.notifications': 'Notificações',
    'common.or': 'ou',
    'common.unlock': 'Desbloquear',
    'common.forgotPassword': 'Esqueceu sua [[senha]]?',
    'common.cancel': 'Cancelar',
    'common.confirm': 'Confirmar',
    'common.delete': 'Excluir',
    'common.report': 'Denunciar',
    'common.block': 'Bloquear',
    'common.check': 'Verificar',
    'common.apply': 'Aplicar',
    'common.accept': 'Aceitar',
    'common.create': 'Criar',
    'auth.sessionRequiredTitle': 'Sessão obrigatória',
    'auth.signInToBlockUsers': 'Entre para bloquear usuários.',
    'auth.signInToReportUsers': 'Entre para denunciar usuários.',
    'home.blockConfirmQuestion': 'Deseja bloquear {user}?',
    'home.blockReasonPlaceholder': 'Motivo do bloqueio (opcional)...',
    'home.reportSelectReason': 'Selecione um motivo para denunciar {user}.',
    'report.reason.sexualContent': 'Conteúdo sexual ou nudez',
    'report.reason.harassment': 'Assédio ou bullying',
    'report.reason.offensiveLanguage': 'Linguagem ofensiva',
    'report.reason.scam': 'Golpe ou fraude',
    'report.reason.violence': 'Violência ou ameaças',
    'report.reason.spam': 'Spam',
    'report.reason.impersonation': 'Falsidade ideológica',
    'report.reason.illegalContent': 'Conteúdo ilegal',
    'report.reason.childSexualAbuse': 'Abuso ou exploração sexual de menores',
    'report.reason.weaponsOrDrugsIncitement': 'Incitação ao uso de armas ou drogas',
    'report.reason.inappropriateConduct': 'Conduta inadequada',
    'report.reason.other': 'Outro',
    'errors.unableToBlockUser': 'Não foi possível bloquear o usuário',
    'errors.unableToSendReport': 'Não foi possível enviar a denúncia',
    'login.email': 'E-mail',
    'login.password': 'Senha',
    'login.emailPlaceholder': 'exemplo@email.com',
    'login.passwordPlaceholder': 'Digite sua senha',
    'login.signIn': 'Entrar',
    'login.fillAllFields': 'Preencha todos os campos',
    'login.invalidCredentials': 'Credenciais inválidas',
    'login.googleNotRegistered': 'Esta conta ainda não está registrada. Cadastre-se primeiro para poder entrar com este e-mail.',
    'login.googlePkceMissing': 'Não foi possível concluir o acesso com Google. Tente novamente.',
    'login.noAccount': 'Não tem conta? ',
    'login.signUp': 'Cadastre-se',
    'login.resetTitle': 'Recuperar senha',
    'login.resetSend': 'Enviar',
    'login.resetVerify': 'Verificar',
    'login.resetChangePassword': 'Alterar senha',
    'login.resetEmailNotRegistered': 'Este e-mail ainda não está em uso no Keinti. Cadastre-se.',
    'login.resetInvalidEmail': 'E-mail inválido',
    'login.resetCodeSent': 'Enviamos um código para seu e-mail.',
    'login.resetPasswordChanged': 'Senha atualizada. Agora você pode entrar.',
    'login.resetCodeLabel': 'Código',
    'login.resetNewPasswordLabel': 'Criar nova senha',
    'login.resetRepeatNewPasswordLabel': 'Repetir nova senha',
    'register.email': 'E-mail',
    'register.username': '@usuário',
    'register.usernameAlreadyInUse': '"{username}" já está sendo usado por outro usuário; tente outro.',
    'register.birthDate': 'Data de nascimento',
    'register.birthDatePlaceholder': 'DD/MM/AAAA',
    'register.gender': 'Gênero',
    'register.selectGender': 'Selecione seu gênero',
    'register.nationality': 'Nacionalidade',
    'register.password': 'Senha',
    'register.confirmPassword': 'Confirmar senha',
    'register.confirmPasswordPlaceholder': 'Confirme sua senha',
    'register.next': 'Próximo',
    'register.signUp': 'Cadastrar',
    'register.registering': 'Cadastrando...',
    'register.successMessage': 'Bem-vindo! Agora você é usuário do Keinti.',
    'register.privacyPrefix': 'Ao se cadastrar, você aceita a ',
    'register.privacyPolicies': 'política de privacidade, política de cookies e publicidade, e os termos e condições de uso',
    'register.privacyPolicyLink': 'política de privacidade',
    'register.cookiesAdsPolicyLink': 'política de cookies e publicidade',
    'register.termsConditionsLink': 'termos e condições de uso',
    'register.privacySeparator1': ', a ',
    'register.privacySeparator2': ', e os ',
    'register.privacySuffix': ' do nosso app Keinti. Para sua segurança, leia-os antes de se cadastrar.',
    'register.errorTitle': 'Erro ao cadastrar',
    'register.unableToComplete': 'Não foi possível concluir o cadastro.',
    'register.selectNationality': 'Selecione sua nacionalidade',
    'register.searchCountry': 'Buscar país...',
    'register.noCountriesFound': 'Nenhum país encontrado',
    'register.emailVerificationTitle': 'Verificação de e-mail',
    'register.emailVerificationHint': 'Enviamos um código para',
    'register.emailVerificationLinkHint': 'Se receber um link de confirmação em vez de um código, abra-o e retornará automaticamente ao Keinti para concluir o cadastro.',
    'register.iConfirmedEmail': 'Já confirmei o e-mail',
    'register.confirmedCheckHint': 'Se já abriu o link, volte ao Keinti. Se nada acontecer, aguarde alguns segundos e toque novamente, ou reenvie o e-mail.',
    'register.code': 'Código',
    'register.codePlaceholder': 'Digite o código',
    'register.timeRemaining': 'Tempo restante',
    'register.verifyAndSignUp': 'Verificar e cadastrar',
    'register.verifying': 'Verificando...',
    'register.resendCode': 'Reenviar e-mail',
    'register.codeExpired': 'O código expirou. Solicite um novo.',
    'register.codeIncorrect': 'Código incorreto',
    'register.codeInvalidInline': 'O código digitado não é válido. Tente novamente.',
    'register.remainingAttempts': 'Tentativas restantes',
    'register.remainingAttemptsInline': 'Tentativas restantes: {count}',
    'register.emailTemporarilyBlocked': 'Muitas tentativas. Reinicie o cadastro com outro e-mail.',
    'register.emailLockedInlineError': 'Este e-mail foi bloqueado temporariamente. Estamos analisando. Envie-nos uma reclamação para que possamos reativar seu e-mail no Keinti.',
    'register.emailLockedRetryInline': 'Este e-mail foi bloqueado temporariamente. Tente outro ou aguarde a resolução de sua solicitação de retificação.',
    'register.rectificationTitle': 'Retificação',
    'register.rectificationPlaceholder': 'Descreva sua retificação (máx. 220 caracteres)',
    'register.rectificationSend': 'Enviar reclamação',
    'register.rectificationSent': 'Reclamação enviada. Analisaremos sua solicitação em breve.',
    'register.tryLaterOrCheckEmailExists': 'Tente mais tarde ou verifique se o e-mail existe',
    'register.mustVerifyEmailFirst': 'Você deve verificar seu e-mail antes de se cadastrar',
    'register.cancelledNotice': 'Cadastro cancelado. Se quiser criar uma nova conta Keinti, comece o processo novamente.',
    'register.emailAlreadyInUse': 'Este e-mail já está em uso por outro usuário Keinti. Tente outro.',
    'register.emailSendFailed': 'Não conseguimos enviar o código para o e-mail "{email}". Verifique se está correto.',
    'register.missingProfileData': 'Faltam dados do cadastro. Volte e complete usuário, data, gênero e nacionalidade.',
    'register.signupExpiredNotice': 'O prazo de verificação expirou. Seus dados foram apagados. Tente novamente.',
    'register.signupExpiredTitle': 'Tempo expirado',
    'register.emailLocked24h': 'Você usou todas as {max} tentativas com este e-mail. Não poderá usá-lo novamente por 48 horas.',
    'register.attemptsRemaining': 'Tentativas restantes: {remaining} de {max}',
    'register.pendingConfirmation': 'Confirme seu e-mail antes do tempo acabar – ainda está ativo.',
    'register.emailLockedTemp': 'Você usou todas as {max} tentativas com este e-mail. Não poderá usá-lo novamente por 48 horas.',
    'register.emailLockedPermanent': 'Seu e-mail foi bloqueado permanentemente por exceder o limite de tentativas. Contate keintisoporte@gmail.com para solicitar desbloqueio.',
    'validation.invalidDateFormat': 'Formato de data inválido',
    'validation.invalidDate': 'Data inválida',
    'validation.mustBeAdult': 'Você deve ter pelo menos 18 anos',
    'validation.passwordMinLength': 'A senha deve ter no mínimo 10 caracteres',
    'validation.passwordMaxLength': 'A senha não pode ter mais de 20 caracteres',
    'validation.passwordNeedsLetter': 'Deve incluir pelo menos 1 letra',
    'validation.passwordNeedsNumber': 'Deve incluir pelo menos 1 número',
    'validation.passwordNeedsSpecial': 'Deve incluir pelo menos 1 caractere especial',
    'validation.passwordsDontMatch': 'As senhas não correspondem',
    'front.editProfilePhoto': 'Editar foto do perfil',
    'front.yourSocialNetworks': 'Suas redes sociais',
    'front.userPlaceholder': 'Usuário',
    'front.selectCategory': 'Selecione uma categoria',
    'front.noPublicationsAvailable': 'Nenhuma publicação disponível',
    'front.socialNetworksSingular': 'rede social',
    'front.socialNetworksPlural': 'redes sociais',
    'front.publish': 'Publicar',
    'front.remove': 'Remover (Publicado)',
    'front.yourProfile': 'Seu perfil',
    'front.yourPresentation': 'Sua apresentação',
    'front.intimacies': 'Intimidades',
    'front.time': 'Tempo',
    'front.loadingImages': 'Carregando imagens...',
    'front.profileEmptyPrimaryMessage': 'Adicione "Sua apresentação" e pelo menos uma "Intimidade" para publicar seu perfil',
    'front.profileEmptySecondaryMessage': 'Ao publicar seu perfil, outros usuários poderão acessar seu canal, onde você poderá compartilhar conteúdo e interagir com eles',
    'front.profileRingHintSelect': 'Selecione uma parte de uma das imagens do carrossel',
    'front.profileRingHintMaxRings': 'Máximo atingido: 5 aros',
    'front.profileRingDelete': 'Deletar aro',
    'front.profileRingNameLabel': 'Nome (máx. 38 caracteres)',
    'front.profileRingNameHelper': 'Produto, empresa, usuário, canal, conteúdo etc.',
    'front.profileRingDescriptionLabel': 'Descrição (máx. 280 caracteres)',
    'front.profileRingLinkLabel': 'Link',
    'front.profileRingLinkHelper': 'Adicione um link de rede social para que os usuários possam acessar o produto, empresa, usuário, canal, publicação, conteúdo etc.',
    'front.profileRingLocationLabel': 'Localização',
    'front.profileRingLocationHelper': 'Adicione uma localização',
    'profile.deleteContentTitle': 'Deletar conteúdo',
    'profile.deleteContentBody': 'Tem certeza de que deseja deletar este conteúdo do seu perfil?',
    'front.reactions': 'Reações',
    'front.deletePublicationTitle': 'Remover publicação',
    'front.deletePublicationBody': 'Seu perfil está público para outros usuários na Home; ao remover, apenas você poderá vê-lo em "Seu perfil".',
    'front.category': 'Categoria',
    'front.presentationAddCarouselHint': 'Adicione até 3 imagens ao carrossel',
    'front.presentationTitleLabel': 'Título',
    'front.presentationTitlePlaceholder': 'Escreva um título...',
    'front.presentationBodyLabel': 'Apresentação',
    'front.presentationBodyPlaceholder': 'Escreva sua apresentação...',
    'front.presentationLockedTitle': 'Edição bloqueada',
    'front.presentationLockedBody': 'Seu perfil está publicado no momento.',
    'front.selectSocialNetwork': 'Selecione uma rede social',
    'front.link': 'Link',
    'front.linkMustBeFrom': 'O link deve ser de',
    'front.incorporate': 'Adicionar',
    'front.answerPlaceholder': 'Resposta...',
    'front.chooseCorrectOption': 'Escolha a opção correta',
    'front.addMoreSurveyOptions': 'Adicione mais opções à pesquisa',
    'front.image': 'Imagem',
    'front.text': 'Texto',
    'front.draftPlaceholder': 'Rascunhe...',
    'front.draftIntimacyPlaceholder': 'Rascunhe uma intimidade...',
    'front.intimaciesPublishBlocked': 'Você ainda não pode publicar intimidades. Primeiro crie "Sua apresentação".',
    'front.homeSwipeTutorialHint': 'Deslize para passar para outra publicação',
    'front.channelLabel': 'Canal:',
    'chat.tabYourChannel': 'Seu canal',
    'chat.tabChannel': 'Canal',
    'chat.tabJoined': 'Entrados',
    'chat.tabYourGroups': 'Seus grupos',
    'chat.tabGroups': 'Grupos',
    'chat.postOnHomeToActivateChannel': 'Publique na Home para ativar seu canal',
    'chat.noChannelsYet': 'Você não tem canais ainda',
    'chat.createGroup': 'Criar um grupo',
    'chat.notJoinedAnyGroupYet': 'Você ainda não entrou em nenhum grupo',
    'chat.back': 'Voltar',
    'chat.interactPlaceholder': 'Interaja...',
    'chat.timeExpired': 'Tempo expirado',
    'chat.remainingPrefix': 'Falta',
    'chat.hour': 'hora',
    'chat.hours': 'horas',
    'chat.minute': 'minuto',
    'chat.minutes': 'minutos',
    'chat.reply': 'Responder',
    'chat.limitWarningMessage': 'Você já interagiu no canal de {user}. Aguarde a resposta.',
    'chat.hostLimitedInteractions': '{user} limitou suas interações',
    'chat.selectGroup': 'Selecione um grupo',
    'chat.toPrefix': 'Para:',
    'chat.request': 'Solicitar',
    'chat.requestPending': 'Pendente',
    'chat.requestAccepted': 'Aceita',
    'chat.requestBlocked': 'Bloqueada',
    'chat.members': 'Membros',
    'chat.messageHidden': 'Mensagem oculta',
    'chat.messageVisible': 'Mensagem visível',
    'chat.lockedYourGroupsMessage': 'Autentique sua conta para criar seus grupos',
    'chat.lockedJoinedGroupsMessage': 'Para acessar os chats dos grupos em que entrou, autentique sua conta',
    'groups.edit': 'Editar',
    'groups.delete': 'Deletar',
    'groups.deleteConfirmTitle': 'Confirmar exclusão',
    'groups.deleteConfirmBody': 'Tem certeza de que deseja deletar este grupo? Todos os usuários serão removidos.',
    'groups.limit': 'Limitar',
    'groups.limited': 'Limitado',
    'groups.expel': 'Expulsar',
    'groups.expelAndBlock': 'Expulsar e bloquear',
    'groups.leaveGroup': 'Sair do grupo',
    'groups.leaveAndBlock': 'Sair e bloquear',
    'groups.limitUsers': 'Limitar usuários',
    'groups.expelUsers': 'Expulsar usuários',
    'groups.selectAll': 'Selecionar todos',
    'groups.deselect': 'Desselecionar',
    'groups.noMembersToShow': 'Nenhum membro para mostrar',
    'notifications.groupJoinRequestMessage': '{user} enviou uma solicitação para você entrar no grupo {group}. Deseja entrar?',
    'notifications.ignore': 'Ignorar',
    'notifications.accept': 'Aceitar',
    'notifications.empty': 'Você não tem notificações',
    'config.title': 'Configurações',
    'config.accountCenter': 'Central da conta',
    'config.blockedUsers': 'Usuários bloqueados',
    'config.devicePermissions': 'Permissões do dispositivo',
    'config.helpCenter': 'Central de ajuda',
    'config.information': 'Sobre o Keinti',
    'config.yourAccountIn': 'Sua conta em',
    'aboutKeinti.title': 'Sobre o Keinti',
    'aboutKeinti.moreAboutKeinti': 'Mais sobre o Keinti',
    'aboutKeinti.body': `Para todos os usuários do Keinti:

O Keinti é uma rede social focada na descoberta de perfis e na interação direta entre pessoas. Nosso objetivo é oferecer um ambiente dinâmico que ajude os usuários a aumentar sua visibilidade, dentro do Keinti e como complemento à sua presença online.

Cada usuário pode criar um perfil público composto por uma Apresentação e espaços onde pode compartilhar reflexões pessoais e aspectos de sua identidade. Essa estrutura ajuda outros membros a compreender melhor seus interesses e estilo. Na tela Home, a plataforma promove a exploração contínua de perfis criados por pessoas do mundo todo.

Quando um perfil despertar interesse, os usuários podem entrar no canal geral do anfitrião/publicador e interagir por meio de conversas em thread. Os publicadores também podem convidar usuários para entrar em seus grupos, a fim de fortalecer e expandir suas comunidades.

Quanto ao desenvolvimento, o Keinti foi totalmente construído com o apoio de inteligência artificial (ChatGPT, Claude Sonnet e Gemini) através do Visual Studio Code. O Keinti iniciou um processo de busca de colaboração para acolher parceiros e colaboradores especializados (desenvolvimento, design gráfico e outros papéis), com foco principal no fortalecimento da segurança e na melhoria da experiência visual do produto.

Para propostas de colaboração, entre em contato: keintisoporte@gmail.com

Atenciosamente,
Equipe Keinti`,
    'verifyKeinti.objectivesTitle': 'Objetivos para conquistar o Keinti Verificado:',
    'verifyKeinti.objective1': '• Autentique sua conta primeiro.',
    'verifyKeinti.complete': 'Completar',
    'verifyKeinti.completed': 'Concluído',
    'verifyKeinti.objective2': '• Obtenha 100.000 aberturas nas suas publicações de intimidades',
    'verifyKeinti.objective3': '• Em um único mês, obtenha pelo menos 1.000 visualizações de outros usuários nas imagens que compartilha nos chats de "Seu canal"',
    'verifyKeinti.objective4': '• Faça 100.000 usuários entrarem no chat de "Seu canal"',
    'verifyKeinti.objective5': '• Crie pelo menos um grupo em "Seus grupos" e faça com que pelo menos 200 membros ativos entrem nesses grupos.',
    'verifyKeinti.objective6': '• Publique seu perfil pelo menos 40 vezes na Home.',
    'verifyKeinti.benefitsTitle': 'Benefícios ao conquistar o Keinti Verificado:',
    'verifyKeinti.benefit1': '• Obtenha a badge dourada.',
    'verifyKeinti.benefit2': '• Gere renda para cada usuário que acesse os chats de "Seu canal".',
    'verifyKeinti.benefit3': '• Gere renda a cada 1.000 visualizações das imagens que compartilha nos chats de "Seu canal"',
    'verifyKeinti.benefit4': '• Obtenha outros privilégios futuros oferecidos pelo Keinti em próximas atualizações.',
    'verifyKeinti.tabObjectives': 'Objetivos',
    'verifyKeinti.tabBenefits': 'Benefícios',
    'verifyKeinti.importantNotice': 'Aviso importante',
    'verifyKeinti.verifyAction': 'Verificar',
    'verifyKeinti.accountVerifiedLabel': 'Conta verificada',
    'devicePermissions.description': 'Aqui você pode ver as permissões que concedeu ao app.',
    'devicePermissions.galleryTitle': 'Galeria (fotos)',
    'devicePermissions.galleryDescription': 'Usada quando você adiciona uma imagem ao seu avatar, à sua apresentação ou às intimidades.',
    'devicePermissions.statusGranted': 'Concedida',
    'devicePermissions.statusDenied': 'Não concedida',
    'devicePermissions.statusUnknown': 'Indisponível',
    'devicePermissions.iosHint': 'No iOS essa permissão é gerenciada pelo sistema e será solicitada ao selecionar uma imagem.',
    'devicePermissions.revokeConfirmTitle': 'Remover permissão',
    'devicePermissions.revokeConfirmBody': 'Tem certeza de que deseja remover a permissão do Keinti de acessar sua galeria?',
    'devicePermissions.reEnableConfirmTitle': 'Permissão da galeria',
    'devicePermissions.reEnableConfirmBody': 'Deseja permitir que o Keinti acesse sua galeria?',
    'devicePermissions.osRequestTitle': 'Permissão da galeria',
    'devicePermissions.osRequestMessage': 'O app precisa de acesso à sua galeria para selecionar fotos.',
    'devicePermissions.osRequestAskLater': 'Perguntar depois',
    'devicePermissions.osRequestDeny': 'Cancelar',
    'devicePermissions.osRequestAllow': 'Permitir',
    'accountCenter.title': 'Central da conta',
    'accountCenter.personalData': 'Dados pessoais',
    'accountCenter.securityControl': 'Controle de segurança',
    'accountCenter.changePassword': 'Alterar senha',
    'accountCenter.adminSelfies': 'Admin: revisar selfies',
    'accountCenter.closeAccount': 'Sair',
    'accountCenter.deleteAccount': 'Excluir conta',
    'accountCenter.deleteAccountConfirmTitle': 'Excluir conta',
    'accountCenter.deleteAccountConfirmBody': 'Tem certeza de que deseja excluir sua conta? Esta ação é irreversível e removerá seus dados do sistema.',
    'accountCenter.accountDeletionPolicyLink': 'Ver política de exclusão de conta',
    'personalData.title': 'Dados pessoais',
    'personalData.description': 'O Keinti usa essas informações para verificar sua identidade e proteger a comunidade.',
    'personalData.contactInfo': 'Informações de contato',
    'personalData.birthDate': 'Data de nascimento',
    'personalData.gender': 'Gênero',
    'personalData.nationality': 'Nacionalidade',
    'securityControl.passwordAndAuth': 'Senha e autenticação',
    'securityControl.passwordAndAuthDescription': 'Nesta seção você pode autenticar seu perfil e alterar sua senha.',
    'securityControl.accountAuth': 'Autenticação da conta',
    'securityControl.privacyPolicy': 'Política de privacidade',
    'securityControl.cookiesAdPolicy': 'Política de cookies e publicidade',
    'securityControl.termsOfUse': 'Termos de uso',
    'securityControl.childSafetyStandards': 'Padrões de segurança infantil',
    'securityControl.accountDeletionPolicy': 'Política de exclusão de conta',
    'securityControl.verifyYourKeinti': 'Verifique seu Keinti',
    'accountAuth.description': 'Para autenticar sua conta você deve completar 2 etapas: selfie de verificação e código do Google Authenticator. A análise da selfie pode levar até 24 horas.',
    'accountAuth.step1Title': 'Etapa 1: selfie de verificação',
    'accountAuth.step1Body': 'Tire uma selfie para que a equipe possa verificar que você é uma pessoa real e maior de idade.',
    'accountAuth.step1Hint': 'Certifique-se de ter boa iluminação e enquadrar seu rosto.',
    'accountAuth.step1Action': 'Tirar selfie',
    'accountAuth.step1Pending': 'Em análise…',
    'accountAuth.step1Blocked': 'Bloqueado',
    'accountAuth.refreshStatus': 'Atualizar status',
    'accountAuth.selfieAccepted': 'Selfie aceita',
    'accountAuth.statusNotSubmitted': 'Status: ainda não enviada.',
    'accountAuth.statusPending': 'Status: em análise (até 24 horas).',
    'accountAuth.statusAccepted': 'Status: aceita. Etapa 2 disponível.',
    'accountAuth.statusFailed': 'Status: falhou. Tente novamente com melhor iluminação e enquadramento.',
    'accountAuth.statusBlocked': 'Status: bloqueado. Você não pode mais enviar selfies até que um administrador o desbloqueie.',
    'accountAuth.errorTitle': 'Erro',
    'accountAuth.selfieUploadError': 'Não foi possível enviar a selfie. Tente novamente.',
    'accountAuth.step2Title': 'Etapa 2: Google Authenticator',
    'accountAuth.step2Body': 'Configure o Google Authenticator e verifique o código para concluir a autenticação.',
    'accountAuth.step2Locked': 'Esta etapa será ativada quando a selfie for aceita.',
    'accountAuth.step2Ready': 'Pronto para configurar o Google Authenticator.',
    'accountAuth.step2AlreadyEnabled': 'Google Authenticator já está ativado.',
    'accountAuth.generateTotp': 'Gerar configuração',
    'accountAuth.secretLabel': 'Chave secreta',
    'accountAuth.secretHint': 'Adicione uma conta no Google Authenticator usando esta chave (manual). Depois digite o código de 6 dígitos.',
    'accountAuth.codeLabel': 'Código',
    'accountAuth.codePlaceholder': '123456',
    'accountAuth.verifyCode': 'Verificar código',
    'accountAuth.totpSetupError': 'Não foi possível gerar a configuração.',
    'accountAuth.verifyError': 'Não foi possível verificar o código.',
    'accountAuth.successTitle': 'Concluído',
    'accountAuth.successBody': 'Sua conta foi autenticada e a badge agora está ativa.',
    'accountAuth.completed': 'Autenticação concluída.',
    'accountAuth.badgeExpiresIn': 'A badge expira em:',
    'changePassword.requirements': 'A senha deve ter no mínimo 10 caracteres e incluir pelo menos um caractere especial (#!@_$€%).',
    'changePassword.currentPassword': 'Senha atual',
    'changePassword.currentPasswordInvalid': 'Senha incorreta',
    'changePassword.newPassword': 'Nova senha',
    'changePassword.repeatNewPassword': 'Repetir nova senha',
    'changePassword.passwordsDontMatch': 'As senhas não correspondem',
    'changePassword.forgot': 'Esqueceu sua senha?',
    'changePassword.success': 'Senha atualizada',
    'changePassword.locked': 'Você atingiu o máximo de tentativas. Tente novamente mais tarde.',
    'changePassword.attemptsRemaining': 'Tentativas restantes: {count}',
    'changePassword.accountLocked': 'Sua conta foi bloqueada. Você será desconectado automaticamente.',
    'changePassword.checkCompleted': 'Verificação concluída',
    'blockedUsers.title': 'Usuários bloqueados',
    'blockedUsers.empty': 'Você não tem usuários bloqueados',
    'adminSelfies.title': 'Admin · Selfies',
    'adminSelfies.tabPending': 'Pendentes',
    'adminSelfies.tabBlocked': 'Bloqueados',
    'adminSelfies.refresh': 'Atualizar',
    'adminSelfies.emptyPending': 'Nenhuma selfie pendente.',
    'adminSelfies.emptyBlocked': 'Nenhum usuário bloqueado.',
    'adminSelfies.reasonPlaceholder': 'Motivo (opcional)',
    'adminSelfies.accept': 'Aceitar',
    'adminSelfies.reject': 'Rejeitar',
    'adminSelfies.block': 'Bloquear',
    'adminSelfies.unblock': 'Desbloquear',
    'blockedUsers.reasonPlaceholder': 'Sem motivo',
    'toast.joinedChannelOf': 'Você entrou no canal de',
    'toast.published': 'Publicado',
    'toast.publicationNotActiveHome': 'A publicação não está mais ativa na Home',
    'toast.joinedGroupMessage': 'Você entrou no grupo {group} de {user}',
    'toast.blocked': 'Bloqueado',
    'toast.reportSent': 'Denúncia enviada',
    'carouselEditor.adjustImage': 'Ajustar imagem',
    'carouselEditor.imageCount': 'Imagem {current} de {total}',
    'carouselEditor.processing': 'Processando...',
    'carouselEditor.noPreview': 'Sem pré-visualização',
    'carouselEditor.editImage': 'Editar imagem',
    'carouselEditor.errorTitle': 'Erro',
    'carouselEditor.cropErrorBody': 'Não foi possível recortar a imagem. Tente novamente.',
    'carouselEditor.ok': 'OK',
  },
};

export function isSupportedLanguage(input: unknown): input is Language {
  const raw = (input ?? '').toString().trim().toLowerCase();
  return (SUPPORTED_LANGUAGES as readonly string[]).includes(raw);
}

export function normalizeLanguage(input: unknown): Language {
  const raw = (input ?? '').toString().trim().toLowerCase();
  return isSupportedLanguage(raw) ? raw : 'es';
}
