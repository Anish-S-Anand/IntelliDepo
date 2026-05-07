"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  getZones, getDensityAnalytics, getCapacityStatus,
  getDensityHistory, getThresholds, getCapacityAlerts,
  type ZoneResponse, type DensityEntry, type DensityHistoryEntry,
  type CapacityAlertResponse, type CapacityStatusEntry,
} from "@/services/depotCluster";
import { getBatches, type BatchResponse } from "@/services/depotSequencing";
import api from "@/services/api";
import {
  MapPin, Layers, AlertTriangle, Thermometer,
  Eye, Loader2, Package, Activity, RefreshCw,
} from "lucide-react";
