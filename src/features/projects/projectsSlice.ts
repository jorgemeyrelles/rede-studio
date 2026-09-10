import {
    createAsyncThunk,
    createSlice,
    type PayloadAction,
} from '@reduxjs/toolkit';
import {
    createProject as createProjectRoute,
    deleteProject as deleteProjectRoute,
    listProjectsByOwner,
    migrateLegacyProjectIfNeeded,
    renameProject as renameProjectRoute,
} from '../../services/routes/projectsRoutes';
import type { CreateProjectInput, ProjectsState } from './types';

const initialState: ProjectsState = {
  items: [],
  status: 'idle',
  error: null,
  activeProjectId: null,
};

export const fetchProjects = createAsyncThunk(
  'projects/fetchProjects',
  async (ownerId: string) => listProjectsByOwner(ownerId),
);

export const createProject = createAsyncThunk(
  'projects/createProject',
  async (input: CreateProjectInput) => createProjectRoute(input),
);

export const renameProject = createAsyncThunk(
  'projects/renameProject',
  async ({ id, name }: { id: string; name: string }) =>
    renameProjectRoute(id, name),
);

export const deleteProject = createAsyncThunk(
  'projects/deleteProject',
  async (id: string) => {
    deleteProjectRoute(id);
    return id;
  },
);

export const migrateLegacyProject = createAsyncThunk(
  'projects/migrateLegacyProject',
  async () => migrateLegacyProjectIfNeeded(),
);

const projectsSlice = createSlice({
  name: 'projects',
  initialState,
  reducers: {
    clearProjects: (state) => {
      state.items = [];
    },
    setActiveProjectId: (state, action: PayloadAction<string | null>) => {
      state.activeProjectId = action.payload;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchProjects.pending, (state) => {
        state.status = 'loading';
        state.error = null;
      })
      .addCase(fetchProjects.fulfilled, (state, action) => {
        state.status = 'idle';
        state.items = action.payload;
      })
      .addCase(createProject.fulfilled, (state, action) => {
        state.items.unshift({
          id: action.payload.id,
          name: action.payload.name,
          ownerId: action.payload.ownerId,
          createdAt: action.payload.createdAt,
          updatedAt: action.payload.updatedAt,
        });
      })
      .addCase(renameProject.fulfilled, (state, action) => {
        if (!action.payload) return;
        const target = state.items.find((p) => p.id === action.payload!.id);
        if (target) Object.assign(target, action.payload);
      })
      .addCase(deleteProject.fulfilled, (state, action) => {
        state.items = state.items.filter((p) => p.id !== action.payload);
      })
      .addCase(migrateLegacyProject.fulfilled, (state, action) => {
        if (action.payload) state.items.unshift(action.payload);
      });
  },
});

export const { clearProjects, setActiveProjectId } = projectsSlice.actions;
export default projectsSlice.reducer;
