/** Maps Firebase Auth error codes to plain messages. Sign-in errors stay generic to avoid revealing which emails exist. */
export function authErrorMessage(err: unknown): string {
  const code = (err as { code?: string })?.code ?? '';
  switch (code) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
    case 'auth/invalid-email':
      return 'The email or password is incorrect.';
    case 'auth/email-already-in-use':
      return 'An account with this email already exists. Sign in instead, or reset your password.';
    case 'auth/weak-password':
      return 'Choose a stronger password: at least 8 characters with a letter and a number.';
    case 'auth/too-many-requests':
      return 'Too many attempts. Wait a few minutes, then try again.';
    case 'auth/network-request-failed':
      return 'Could not reach SportBridge. Check your connection and try again.';
    case 'auth/user-disabled':
      return 'This account has been suspended. Contact SportBridge support.';
    default:
      if ((err as Error)?.message === 'FIREBASE_NOT_CONFIGURED')
        return 'Sign-in is not set up on this environment yet.';
      return 'Something went wrong. Try again.';
  }
}
