import React, { useCallback, useState } from 'react';
import { RefreshControl } from 'react-native';
import { useApp } from '@/context/AppContext';
import { colors } from '@/theme';

// The pull-to-refresh control used by every list screen: syncs anything
// queued and reloads the user's data, tinted to match the app.
export function usePullToRefresh() {
  const { refreshData } = useApp();
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refreshData();
    } finally {
      setRefreshing(false);
    }
  }, [refreshData]);

  return <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} colors={[colors.primary]} />;
}
