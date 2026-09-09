import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import { authRoutes } from '../../services/routes/authRoutes';
import type {
    AuthErrorCode,
    AuthState,
    LoginInput,
    OAuthProvider,
    PublicUser,
    RegisterInput,
    UpdateUserProfileInput,
} from './types';

const initialState: AuthState = {
  currentUser: null,
  status: 'idle',
  error: null,
  initialized: false,
};

export const hydrateSession = createAsyncThunk(
  'auth/hydrateSession',
  async () => authRoutes.getPersistedSession(),
);

export const registerUser = createAsyncThunk<
  PublicUser,
  RegisterInput,
  { rejectValue: AuthErrorCode }
>('auth/registerUser', async (input, { rejectWithValue }) => {
  const result = await authRoutes.registerUser(input);
  if (!result.ok) return rejectWithValue(result.error);
  return result.user;
});

export const loginUser = createAsyncThunk<
  PublicUser,
  LoginInput,
  { rejectValue: AuthErrorCode }
>('auth/loginUser', async (input, { rejectWithValue }) => {
  const result = await authRoutes.loginUser(input);
  if (!result.ok) return rejectWithValue(result.error);
  return result.user;
});

export const loginWithOAuthProvider = createAsyncThunk<
  PublicUser,
  { provider: OAuthProvider; idToken: string },
  { rejectValue: AuthErrorCode }
>('auth/loginWithOAuthProvider', async ({ provider, idToken }, { rejectWithValue }) => {
  const result = await authRoutes.loginWithOAuth(provider, idToken);
  if (!result.ok) return rejectWithValue(result.error);
  return result.user;
});

export const logoutUser = createAsyncThunk('auth/logoutUser', async () => {
  await authRoutes.logoutSession();
});

export const updateUserProfile = createAsyncThunk<
  PublicUser,
  UpdateUserProfileInput,
  { state: { auth: AuthState }; rejectValue: AuthErrorCode }
>('auth/updateUserProfile', async (changes, { getState, rejectWithValue }) => {
  if (!getState().auth.currentUser) return rejectWithValue('NOT_AUTHENTICATED');
  const result = await authRoutes.updateUserProfile(changes);
  if (!result.ok) return rejectWithValue(result.error);
  return result.user;
});

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    clearAuthError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(hydrateSession.fulfilled, (state, action) => {
        state.currentUser = action.payload;
        state.initialized = true;
      })
      .addCase(registerUser.pending, (state) => {
        state.status = 'loading';
        state.error = null;
      })
      .addCase(registerUser.fulfilled, (state, action) => {
        state.status = 'idle';
        state.currentUser = action.payload;
      })
      .addCase(registerUser.rejected, (state, action) => {
        state.status = 'idle';
        state.error = action.payload ?? 'GENERIC';
      })
      .addCase(loginUser.pending, (state) => {
        state.status = 'loading';
        state.error = null;
      })
      .addCase(loginUser.fulfilled, (state, action) => {
        state.status = 'idle';
        state.currentUser = action.payload;
      })
      .addCase(loginUser.rejected, (state, action) => {
        state.status = 'idle';
        state.error = action.payload ?? 'GENERIC';
      })
      .addCase(loginWithOAuthProvider.pending, (state) => {
        state.status = 'loading';
        state.error = null;
      })
      .addCase(loginWithOAuthProvider.fulfilled, (state, action) => {
        state.status = 'idle';
        state.currentUser = action.payload;
      })
      .addCase(loginWithOAuthProvider.rejected, (state, action) => {
        state.status = 'idle';
        state.error = action.payload ?? 'GENERIC';
      })
      .addCase(logoutUser.fulfilled, (state) => {
        state.currentUser = null;
      })
      .addCase(updateUserProfile.fulfilled, (state, action) => {
        state.currentUser = action.payload;
      })
      .addCase(updateUserProfile.rejected, (state, action) => {
        state.error = action.payload ?? 'GENERIC';
      });
  },
});

export const { clearAuthError } = authSlice.actions;
export default authSlice.reducer;
