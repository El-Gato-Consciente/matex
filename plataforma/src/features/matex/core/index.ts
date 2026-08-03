/**
 * `matex-core` — el modelo semántico Matex y su compilador a LaTeX. **Puro**
 * (sin DOM ni frameworks): lo consume el editor visual, pero nunca al revés.
 */
export type {
  Mark,
  TextNode,
  MathInlineNode,
  RefNode,
  InlineNode,
  HeadingNode,
  ParagraphNode,
  ListItemNode,
  BulletListNode,
  OrderedListNode,
  MathDisplayNode,
  EquationRow,
  DerivationNode,
  DerivationStep,
  ReasoningNode,
  ReasoningRow,
  TheoremVariant,
  TheoremNode,
  TableAlign,
  TableCellNode,
  TableRowNode,
  TableNode,
  FigureNode,
  FigureItem,
  FigureImage,
  FigurePlot,
  FigureChart,
  FigureDist,
  FigureDiagram,
  DiagramSpec,
  DiagramNode,
  DiagramEdge,
  DiagramForm,
  DiagramTip,
  DiagramEdgeStyle,
  FigureTree,
  TreeSpec,
  TreeNode,
  TreeForm,
  ChartSpec,
  ChartSeries,
  ChartForm,
  DistSpec,
  DistSeries,
  DistForm,
  PlotSpec,
  PlotParameter,
  PlotFunction,
  PlotArea,
  PlotPoint,
  PlotVLine,
  PlotHLine,
  PlotText,
  PlotTangent,
  AreaPattern,
  PlotDataSeries,
  PlotParametric,
  PlotPolar,
  PlotImplicit,
  PlotIntersection,
  CurveRef,
  CurveKind,
  PlotPiece,
  PlotLineStyle,
  PlotLegendPos,
  RawLatexNode,
  CodeBlockNode,
  CalloutNode,
  CalloutVariant,
  IncludeNode,
  CiteNode,
  FootnoteNode,
  BibEntry,
  BibEntryType,
  BibStyle,
  BlockNode,
  DocMeta,
  DocumentFamily,
  LetterMeta,
  ExamMeta,
  CvMeta,
  PosterMeta,
  PageColumns,
  DocKind,
  DocStyle,
  AccentColor,
  PaperSize,
  BaseFontSize,
  Author,
  MatexDoc,
} from './ast'
export { MATEX_AST_VERSION } from './ast'
export { documentFamily, letterMeta, examMeta, cvMeta, posterMeta, FAMILY_LABEL, type DocFamily } from './family'
export { emitBibtex, parseBibtex, autoKey } from './bibtex'
export { resolvePlotFunctions } from './graphics/functionRefs'
export { resolvePlotParameters, substituteParamsInExpr } from './graphics/parameters'
export { implicitCurve, parseImplicit, type Viewport } from './graphics/implicit'
export { intersectionPoints, curveToPolylines, polylineIntersections } from './graphics/intersect'
export { detectFeatures, detectAsymptotes, type DetectedFeature, type FeatureKind, type Asymptote } from './graphics/features'
export { interpolateSeries, interpolateEvaluator, INTERP_METHODS, INTERP_GROUP_LABEL, type InterpMethod, type InterpResult, type InterpGroup, type InterpMethodMeta } from './graphics/interpolate'
export { plotToSvg, plotDisplayWindow, plotLegendHtml, plotFeatureLegendHtml, equalAxesExpand, plotValuesAt, PLOT_VIEW, type PlotView } from './graphics/relationSvg'
export { chartToSvg } from './graphics/chartSvg'
export { distToLatex, histogram, boxplot } from './graphics/distribution'
export { distToSvg } from './graphics/distributionSvg'
export { diagramToLatex } from './graphics/diagram'
export { diagramToSvg } from './graphics/diagramSvg'
export { treeToLatex } from './graphics/tree'
export { treeToSvg } from './graphics/treeSvg'
export { equationPlan, type EquationPlan } from './equation'
export {
  parseExpr,
  parseExprXY,
  evalExpr,
  evalExprXY,
  exprToPgfplots,
  compileExprToPgfplots,
  exprToLatex,
  compileExprToLatex,
  exprToAscii,
  compileExprToAscii,
  type ExprNode,
  type ExprSyntax,
  type ParseResult,
} from './plotExpr'
export { PLOT_COLORS, plotColor, plotColorByName, resolvePlotColor, type PlotColor } from './plotColors'
export { resolvePlotStyle, PLOT_ROLES, PLOT_ROLE_LABEL, type EffectivePlotStyle, type PlotRole } from './plotTheme'
export { compileToLatex } from './compile'
export { compileToHtml, type HtmlOptions } from './html'
export { parseMatexDoc, serializeMatexDoc } from './parse'
export { MATEX_MACROS, matexMacroPreamble, matexKatexMacros, type MatexMacro } from './macros'
