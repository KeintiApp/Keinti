export type Language = 'es' | 'en';

export type TranslationKey =
  | 'language.label'
  | 'language.spanish'
  | 'language.english'
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
  'login.resetEmailNotRegistered': 'Este correo no está registrado',
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
  'front.homeSwipeTutorialHint': 'Desliza a un lado u otro para visualizar otra publicación',

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
  'login.resetEmailNotRegistered': 'This email is not registered',
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
  'front.homeSwipeTutorialHint': 'Swipe left or right to view another post',

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
};

export function normalizeLanguage(input: unknown): Language {
  const raw = (input ?? '').toString().trim().toLowerCase();
  if (raw === 'en') return 'en';
  return 'es';
}
