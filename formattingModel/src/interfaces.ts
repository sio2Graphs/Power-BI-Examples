"use strict";
import powerbi from "powerbi-visuals-api";

interface iDataPoint { label: string, color: string; identity: powerbi.visuals.ISelectionId; highlighted: boolean; }
interface iDataModel { dataPoints: iDataPoint[]; highlights: boolean; }

export {iDataPoint, iDataModel};
