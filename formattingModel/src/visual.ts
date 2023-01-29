"use strict";
/* PBI License
*  Power BI Visual CLI
*
*  Copyright (c) Microsoft Corporation
*  All rights reserved.
*  MIT License
*
*  Permission is hereby granted, free of charge, to any person obtaining a copy
*  of this software and associated documentation files (the ""Software""), to deal
*  in the Software without restriction, including without limitation the rights
*  to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
*  copies of the Software, and to permit persons to whom the Software is
*  furnished to do so, subject to the following conditions:
*
*  The above copyright notice and this permission notice shall be included in
*  all copies or substantial portions of the Software.
*
*  THE SOFTWARE IS PROVIDED *AS IS*, WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
*  IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
*  FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
*  AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
*  LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
*  OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
*  THE SOFTWARE.
*/

import "./../style/visual.less";
import {iDataPoint, iDataModel} from "./interfaces";
import powerbi from "powerbi-visuals-api";
import VisualConstructorOptions = powerbi.extensibility.visual.VisualConstructorOptions;
import VisualUpdateOptions = powerbi.extensibility.visual.VisualUpdateOptions;
import IVisual = powerbi.extensibility.visual.IVisual;
import IVisualHost = powerbi.extensibility.visual.IVisualHost;
import ISelectionManager = powerbi.extensibility.ISelectionManager;
import DataView = powerbi.DataView;
import * as d3 from "d3";
import { dataViewObjects } from "powerbi-visuals-utils-dataviewutils";
import IVisualEventService = powerbi.extensibility.IVisualEventService;
import { FormattingSettingsService } from "powerbi-visuals-utils-formattingmodel";
import { visualSettings } from "./userSettings";
import { barCard } from "./formatSettings";

export class Visual implements IVisual {
  private selectionManager: ISelectionManager;
  private host: IVisualHost;
  private svg: d3.Selection<d3.BaseType, any, SVGElement, any>;
  private element: HTMLElement;
  private formattingSettingsService: FormattingSettingsService;
  private events: IVisualEventService;
  private vS: visualSettings;
  private iDM: iDataModel;
  private dP: iDataPoint[];

  constructor(options: VisualConstructorOptions) {
    this.element = options.element
    this.element.style.overflowY = "hidden";
    this.host = options.host;
    this.selectionManager =  this.host.createSelectionManager();
    if (typeof document !== undefined) { this.svg = d3.select(this.element).append("svg"); }
    this.events = options.host.eventService;
    this.formattingSettingsService = new FormattingSettingsService();

    this.handleContextMenu();
  }

  private getviewModel(options: VisualUpdateOptions): iDataModel {
    const dataArray: {category: string, value: number}[] = [];
    const dV: DataView[] = options.dataViews;
    const highlights = dV[0].categorical.values[0].highlights;
    const objects: object = dV[0].categorical.categories[0].objects;
    const dataModel: iDataModel = { dataPoints: [], highlights: false };

    if (!dV || !dV[0] || !dV[0].categorical || !dV[0].categorical.categories || !dV[0].categorical.categories[0].source || !dV[0].categorical.values || !dV[0].metadata) { return dataModel }
    else {
      let cleanedCategory = "";
      dV[0].categorical.categories[0].values.forEach((item, i) => {
        if(item == 0) { cleanedCategory =  item.toString(); }
        else if(!item) { cleanedCategory = ""; }
        else { cleanedCategory =  item.toString(); }

        dataArray.push({
          category: cleanedCategory,
          value: <number>dV[0].categorical.values[0].values[i] });
      });

      dataArray.forEach((item, i) => {
        dataModel.dataPoints.push({
          label: item.category,
          color:  objects && objects[i] && dataViewObjects.getFillColor(objects[i], { objectName: "bar", propertyName: "individualSolids"}, null) || this.host.colorPalette.getColor(item.category).value,
          identity: this.host.createSelectionIdBuilder().withCategory(dV[0].categorical.categories[0], i).createSelectionId(),
          highlighted: highlights ? highlights[i] ? true : false : false
        })
      });
    }

    this.dP = dataModel.dataPoints;

    return dataModel;
  }

  public update(options: VisualUpdateOptions) {
    this.events.renderingStarted(options);

    this.vS = this.formattingSettingsService.populateFormattingSettingsModel(visualSettings, options.dataViews);
    this.iDM = this.getviewModel(options);

    this.svg.selectAll("*").remove();
    this.svg.style("width", options.viewport.width)
    this.element.style.overflowX = "hidden";
    const group: d3.Selection<SVGGElement, any, SVGElement, any> = this.svg.append("g");
    this.bars(options, group, this.selectionManager);

    this.events.renderingFinished(options);
  }

  public getFormattingModel(): powerbi.visuals.FormattingModel {
    const bar = barCard(this.dP);

    const formattingModel: powerbi.visuals.FormattingModel = { cards: [bar] };
    return formattingModel;
  }

  private handleContextMenu() {
    this.svg.on("contextmenu", (event) => {
      const dataPoint: any = d3.select(event.target).datum();
      this.selectionManager.showContextMenu((dataPoint && dataPoint.data && dataPoint.data.identity) ? dataPoint.selectionId  : {}, { //.data.identity
        x: event.clientX,
        y: event.clientY
      });
      event.preventDefault();
    });
  }

  private bars(options: VisualUpdateOptions, g: d3.Selection<SVGGElement, any, SVGElement, any>, selMan: ISelectionManager): void {
    d3.selectAll(".bar").remove();
    const parentHost: IVisualHost = this.host;
    const w = options.viewport.width
    const h = options.viewport.height
    const catW = (w - 50 - (this.iDM.dataPoints.length * 2)) / this.iDM.dataPoints.length
    let bars: d3.Selection<d3.BaseType, any, d3.BaseType, any> = g.selectAll(".bar");

    bars = g.selectAll(".bar")
      .data(this.iDM.dataPoints)
      .enter()
      .append("rect")
      .attr("class", "bar")
      .attr("x", (d,i) => 25 + ((catW + 2) * i))
      .attr("y", (d,i) => i * 60)
      .attr("width", catW)
      .attr("height", (d,i) => h - 10 - (i * 60))
      .attr("fill-opacity", 1)
      .style("fill", d => d.color)
      .on("click", (event, d) => {
        if (parentHost.hostCapabilities.allowInteractions) {
          selMan.select(d.identity, true).then((ids: powerbi.visuals.ISelectionId[]) => {
            bars.attr("fill-opacity", (d) => {
              return ids.length > 0 ? (ids.indexOf(d.identity) >= 0 ? 1: .25) : 1
            })
          });
          (<Event>event).stopPropagation();
        }
      })
  }
}