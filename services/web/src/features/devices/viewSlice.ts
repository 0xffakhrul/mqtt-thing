import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { Range } from '../../lib/ranges.js';

type ViewState = {
  metric: string;
  range: Range;
};

const initialState: ViewState = {
  metric: 'temp_c',
  range: '1h',
};

export const viewSlice = createSlice({
  name: 'view',
  initialState,
  reducers: {
    metricSelected: (state, action: PayloadAction<string>) => {
      state.metric = action.payload;
    },
    rangeSelected: (state, action: PayloadAction<Range>) => {
      state.range = action.payload;
    },
  },
});

export const { metricSelected, rangeSelected } = viewSlice.actions;
