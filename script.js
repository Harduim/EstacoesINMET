const APIURL = 'https://apitempo.inmet.gov.br'
const CORES = {
  verde: '#00D35C',
  branco: '#FFFFFF',
  limao: '#C4F27A',
  azul_escuro: '#1A1B86',
  preto: '#000000',
  cinza_escuro: '#12121D',
  cinza_medio: '#4A4A57',
  cinza_claro: '#ECF1F4',
  branco_clear: '#FAFCFE',
  azul_meia_noite: '#18197A',
  azul_pantone: '#311AA1',
  roxo: '#4719BB',
  roxo_indigo: '#7417EF',
  laranja_chama: '#E84800',
  laranja_international: '#FF4F00',
  laranja_amarelo: '#FF9200',
  amarelo_cyber: '#FFD400',
  amarelo_pantone: '#FFDF3F',
  amarelo_titanium: '#DDDD00',
  verde_malachite: '#62E36B'
}
const ADD = 'ADD'
const REMOVE = 'REMOVE'
const BULK_REPLACE = 'BULK_REPLACE'
const ESTACOES = 'ESTACOES'
const MEDICOES = 'MEDICOES'
const ALL = 'ALL'
const SERIESVARS = {
  diario: [
    ['CHUVA', 'Precipitação Total [mm]'],
    ['PRESS_ATM_MED', 'Pressao Atmosferica Media [mB]'],
    ['TEMP_MAX', 'Temperatura Máxima [°C]'],
    ['TEMP_MED', 'Temperatura Média [°C]'],
    ['TEMP_MIN', 'Temperatura Mínima [°C]'],
    ['UMID_MED', 'Umidade Relativa Do Ar, Media Diaria [%]'],
    ['UMID_MIN', 'Umidade Relativa Do Ar, Minima Diaria [%]'],
    ['VEL_VENTO_MED', 'Vento, Velocidade Média [m/s]']
  ],
  horario: [
    ['VEN_DIR', 'Vento, Direção °'],
    ['CHUVA', 'Precipitação Total [mm]'],
    ['PRE_INS', 'Pressão Atm Ao Nível Da Estacão [mB]'],
    ['PRE_MIN', 'Pressão Atmosférica Min. Na Hora [mB]'],
    ['UMD_MAX', 'Umidade Rel. Max. Na Hora [%]'],
    ['PRE_MAX', 'Pressão Atmosférica Max.Na Hora [mB]'],
    ['VEN_VEL', 'Vento, Velocidade [m/s]'],
    ['PTO_MIN', 'Temperatura Orvalho Min. Na Hora [°C]'],
    ['TEM_MAX', 'Temperatura Máxima Na Hora [°C]'],
    ['RAD_GLO', 'Radiação Global KJ/m²'],
    ['PTO_INS', 'Temperatura Do Ponto De Orvalho [°C]'],
    ['VEN_RAJ', 'Vento, Rajada Máxima [m/s]'],
    ['TEM_INS', 'Temperatura Do Ar - Bulbo Seco [°C]'],
    ['UMD_INS', 'Umidade Relativa Do Ar [%]'],
    ['TEM_MIN', 'Temperatura Mínima Na Hora [°C]'],
    ['UMD_MIN', 'Umidade Rel. Min. Na Hora [%]'],
    ['PTO_MAX', 'Temp. Orvalho Max. Na Hora [°C]']
  ]
}
const VARSSERIES = {
  diario: Object.fromEntries(SERIESVARS.diario),
  horario: Object.fromEntries(SERIESVARS.horario)
}
const PLOT_TEMPLATE = {
  data: {},
  layout: {
    hovermode: 'x unified',
    paper_bgcolor: CORES.branco_clear,
    plot_bgcolor: CORES.branco_clear,
    xaxis: {
      type: 'datetime',
      gridcolor: CORES.branco_clear
    },
    yaxis: { gridcolor: CORES.cinza_claro },
    yaxis2: { gridcolor: CORES.branco_clear },
    margin: { b: 40, t: 60, l: 50, r: 30 },
    legend: {
      orientation: 'h',
      yanchor: 'middle',
      xanchor: 'center',
      x: '0.5',
      y: '1.1'
    }
  }
}
const rangeselector = {
  buttons: [
    {
      count: 6,
      label: 'Uma semana',
      step: 'day',
      stepmode: 'backward'
    },
    { step: 'all' }
  ]
}

let update
let subscribe

const media_lista = lista => lista.reduce((a, b) => parseFloat(a) + parseFloat(b), 0) / lista.length

const variancia = lista => {
  const media = media_lista(lista)
  let x = 0
  for (n in lista) {
    x = x + (lista[n] - media) ** 2
  }
  return x / lista.length
}

const desvio_padrao = lista => Math.sqrt(variancia(lista))

const covar = (listaX, listaY) => {
  if (listaX.length !== listaY.length) throw 'listas devem ser do mesmo tamanho'

  const mediaX = media_lista(listaX)
  const mediaY = media_lista(listaY)
  let cov = 0
  let x = 0
  let y = 0
  n = listaX.length

  for (let i = 0; i < listaX.length; i++) {
    x = listaX[i]
    y = listaY[i]
    // Considerando população e não amostra: (n - 0)
    cov = cov + ((x - mediaX) * (y - mediaY)) / (n - 0)
  }

  return cov
}

const rmse = (listaX, listaY) => {
  const diff_sq = listaX.map((x, i) => (x - listaY[i]) ** 2)
  const diff_mean = media_lista(diff_sq)
  return Math.sqrt(diff_mean)
}

const pearson_corr = (listaX, listaY) => covar(listaX, listaY) / (desvio_padrao(listaY) * desvio_padrao(listaX))

const linear_reg = (listaX, listaY) => {
  const corr = pearson_corr(listaX, listaY)
  let slope = corr * (desvio_padrao(listaY) / desvio_padrao(listaX))

  slope = parseFloat(slope.toFixed(3))

  const intercept = media_lista(listaY) - slope * media_lista(listaX)

  return { slope, intercept }
}

const predict = (regression, lista) => lista.map(n => regression.intercept + regression.slope * n)

const store = (state = {}) => {
  // Gerenciamento centralizado do estado da aplicação

  const _state = state
  // {callback: f(), dataTypes: []}
  const _callbacks = []

  const update = (data, dataType, action, idKey) => {
    if (!_state[dataType]) _state[dataType] = []

    switch (action) {
      case ADD:
        _state[dataType] = _state[dataType].concat(...data)
        break
      case REMOVE:
        _state[dataType] = Array.from(_state[dataType].filter(e => data[idKey] !== e[idKey]))
        break
      case BULK_REPLACE:
        _state[dataType] = [...data]
        break
      default:
        console.log('No Action taken')
    }

    _callbacks.forEach(
      c => {
        const { callback, dataTypes } = c
        if (!dataTypes.includes(dataType)) return
        for (const dt of dataTypes) {
          if (!Object.keys(_state).includes(dt)) return
        }
        callback(Object.assign(_state))
      }
    )
  }

  const subscribe = (callback, dataTypes) => {
    _callbacks.push({ callback, dataTypes })
  }

  return [update, subscribe]
}

const storeEstacoes = (_update) => {
  fetch(`${APIURL}/estacoes/T`)
    .then((response) => response.json())
    .then((json) => _update(json, ESTACOES, BULK_REPLACE, 'CD_ESTACAO'))
}

const storeHorario = (cod_estacao, dt_in, dt_fin, _update) => {
  fetch(`${APIURL}/estacao/${dt_in}/${dt_fin}/${cod_estacao}`)
    .then((response) => response.json())
    .then((json) => _update(json, MEDICOES, BULK_REPLACE, 'CD_ESTACAO'))
}

const storeDiario = (cod_estacao, dt_in, dt_fin, _update) => {
  fetch(`${APIURL}/estacao/diaria/${dt_in}/${dt_fin}/${cod_estacao}`)
    .then((response) => response.json())
    .then((json) => _update(json, MEDICOES, BULK_REPLACE, 'CD_ESTACAO'))
}

const handleMeasurementsVars = (state) => {
  const [mVarA, mVarB] = state.measurementVars
  measurementTypeA.value = mVarA
  measurementTypeB.value = mVarB
  tblVarA.innerText = mVarA
  tblVarB.innerText = mVarB
}

const handleMeasurementsVarsChange = () => {
  const mVarA = measurementTypeA.value
  const mVarB = measurementTypeB.value
  update([mVarA, mVarB], 'measurementVars', BULK_REPLACE)
}

const handleMeasurementsOptions = (state) => {
  renderMeasurementsOptions(state.measurementType, 'measurementTypeA')
  renderMeasurementsOptions(state.measurementType, 'measurementTypeB')

  const defaultVars = {
    diario: ['VEL_VENTO_MED', 'TEMP_MED'],
    horario: ['VEN_VEL', 'TEM_INS']
  }

  update(defaultVars[state.measurementType], 'measurementVars', BULK_REPLACE)
}

const handleEstacaoIdChange = () => {
  update([estacaoId.value], 'ESTACAO', BULK_REPLACE)
}

const handleSubmit = e => {
  e.preventDefault()
  let { estacaoId, dateIn, dateFin, measurementType } = e.target
  estacaoId = estacaoId.value
  dateIn = dateIn.value
  dateFin = dateFin.value
  measurementType = measurementType.value

  if (dateIn >= dateFin) {
    dateValidationFeedback.classList.toggle('to-display')
    return
  }
  dateValidationFeedback.classList.remove('to-display')

  update([measurementType], 'measurementType', BULK_REPLACE)

  if (measurementType === 'horario') {
    storeHorario(estacaoId, dateIn, dateFin, update)
  } else {
    storeDiario(estacaoId, dateIn, dateFin, update)
  }
}

const renderEstacaoSelect = (state) => {
  state.ESTACOES.sort((a, b) => a.CD_ESTACAO.localeCompare(b.CD_ESTACAO)).forEach(
    e => {
      if (e.CD_SITUACAO !== 'Operante') return
      const option = document.createElement('option')
      const msgFimOperacao = e.DT_FIM_OPERACAO ? ` Fim de operação em: ${e.DT_FIM_OPERACAO}` : ''
      option.value = e.CD_ESTACAO
      option.innerText = `${e.CD_ESTACAO} - ${e.SG_ESTADO} ${e.DC_NOME}${msgFimOperacao}`
      estacaoId.appendChild(option)
    }
  )
  estacaoId.value = 'A756'
}

const renderMeasurementsOptions = (measurementType, selectId) => {
  const select = document.getElementById(selectId)
  select.innerText = ' '

  SERIESVARS[measurementType].forEach(
    e => {
      const [vid, description] = e
      const option = document.createElement('option')
      option.innerText = description
      option.value = vid
      select.appendChild(option)
    }
  )
}

const renderDataTable = (state) => {
  const { measurementVars, MEDICOES } = state
  const [mVarA, mVarB] = measurementVars
  const axes = MEDICOES.filter(e => e[mVarA] && e[mVarB]).map(e => [e[mVarA], e[mVarB]])
  const xAxis = axes.map(e => e[0])
  const yAxis = axes.map(e => e[1])

  xMax.innerText = Math.max(...xAxis)
  yMax.innerText = Math.max(...yAxis)
  xMin.innerText = Math.min(...xAxis)
  yMin.innerText = Math.min(...yAxis)
  xSTD.innerText = desvio_padrao(xAxis).toFixed(1)
  ySTD.innerText = desvio_padrao(yAxis).toFixed(1)
  xVariance.innerText = variancia(xAxis).toFixed(1)
  yVariance.innerText = variancia(yAxis).toFixed(1)
  axesCovar.innerText = covar(xAxis, yAxis).toFixed(1)
}

const getDateFormatter = (measurementType) => {
  return {
    horario: m => new Date(`${m.DT_MEDICAO} ${m.HR_MEDICAO.slice(0, 2)}:${m.HR_MEDICAO.slice(2, 4)}`),
    diario: m => new Date(m.DT_MEDICAO)
  }[measurementType]
}

const plotLineGraph1 = (state) => {
  const { measurementVars, MEDICOES } = state
  const [mVarA, mVarB] = measurementVars
  const [measurementType] = state.measurementType
  const formatDate = getDateFormatter(measurementType)

  let xAxis
  try {
    xAxis = MEDICOES.map(formatDate)
  } catch (TypeError) {
    return console.log('Loading graph data')
  }

  const trace1 = {
    x: xAxis,
    y: MEDICOES.map(e => e[mVarA]),
    mode: 'lines+markers',
    name: mVarA,
    marker: { color: CORES.roxo }
  }

  const trace2 = {
    x: xAxis,
    y: MEDICOES.map(e => e[mVarB]),
    mode: 'lines+markers',
    name: mVarB,
    yaxis: 'y2',
    marker: { color: CORES.laranja_chama }
  }

  const data = [trace1, trace2]
  const layout = {
    template: PLOT_TEMPLATE,
    xaxis: {
      autorange: true,
      rangeselector,
      rangeslider: { range: [] }
    },
    yaxis: { title: VARSSERIES[measurementType][mVarA] },
    yaxis2: {
      title: VARSSERIES[measurementType][mVarB],
      overlaying: 'y',
      side: 'right'
    }
  }

  Plotly.newPlot('linePlot1', data, layout, { responsive: true })
}

const plotLineGraph2 = (state) => {
  const { measurementVars, MEDICOES } = state
  const [mVarA, mVarB] = measurementVars
  const [measurementType] = state.measurementType
  const formatDate = getDateFormatter(measurementType)

  const axes = MEDICOES.filter(e => e[mVarA] && e[mVarB]).map(e => [e[mVarA], e[mVarB]])
  const aAxis = axes.map(e => e[0])
  const bAxis = axes.map(e => e[1])

  const aRegression = linear_reg(aAxis, bAxis)
  const bRegression = linear_reg(bAxis, aAxis)

  const aPred = predict(bRegression, bAxis)
  const bPred = predict(aRegression, aAxis)

  let xAxis
  try {
    xAxis = MEDICOES.map(formatDate)
  } catch (TypeError) {
    return console.log('Loading graph data')
  }

  const plt = (grahphId, varName, real, pred) => {
    const trace1 = {
      x: xAxis,
      y: real,
      mode: 'lines+markers',
      name: 'Real',
      marker: { color: CORES.roxo }
    }

    const trace2 = {
      x: xAxis,
      y: pred,
      mode: 'lines+markers',
      name: 'Extrapolada',
      marker: { color: CORES.laranja_chama }
    }

    const data = [trace1, trace2]
    const layout = {
      template: PLOT_TEMPLATE,
      yaxis: { title: varName },
      xaxis: { rangeselector, rangeslider: { range: [] } }
    }

    Plotly.newPlot(grahphId, data, layout, { responsive: true })
  }
  plt('linePlot2', VARSSERIES[measurementType][mVarA], aAxis, aPred)
  plt('linePlot3', VARSSERIES[measurementType][mVarB], bAxis, bPred)
}


const plotScatterLine = (state) => {
  const { measurementVars, MEDICOES } = state
  const [mVarA, mVarB] = measurementVars
  const [measurementType] = state.measurementType


  const trace1 = {
    x: MEDICOES.map(e => e[mVarA]),
    y: MEDICOES.map(e => e[mVarB]),
    mode: 'markers',
    name: mVarA,
    marker: { color: CORES.roxo }
  }

  const binCount = 5
  const binSize = Math.ceil(Math.max(...MEDICOES.map(e=>parseFloat(e[mVarA]))) / binCount)
  const pairsGroup = MEDICOES.map(
    e => {
      return { bin: Math.round(e[mVarA] / binSize) * binSize, mVarA: e[mVarA], mVarB: e[mVarB] }
    }
  )
  const uniqueKeys = [...new Set(pairsGroup.map(e => e.bin))].sort((a, b) => a - b)

  const line = uniqueKeys.map(
    k => {
      const toGroup = pairsGroup.filter(pg => pg.bin === k)

      const _mVarA = toGroup.map(e => e.mVarA).reduce((a, b) => parseFloat(a) + parseFloat(b)) / toGroup.length
      const _mVarB = toGroup.map(e => e.mVarB).reduce((a, b) => parseFloat(a) + parseFloat(b)) / toGroup.length


      return { bin: k, mVarA: _mVarA, mVarB: _mVarB }
    }
  )

  const trace2 = {
    x: line.map(e => e.mVarA),
    y: line.map(e => e.mVarB),
    mode: 'lines',
    name: 'Média',
    marker: { color: CORES.laranja_chama }
  }

  const data = [trace1, trace2]

  const layout = {
    template: PLOT_TEMPLATE,
    yaxis: { title: VARSSERIES[measurementType][mVarB] },
    xaxis: { title: VARSSERIES[measurementType][mVarA] },
  }


  Plotly.newPlot('scatterLine', data, layout, { responsive: true })
}


const setCSSColors = () => {
  Object.entries(CORES).forEach(
    c => document.documentElement.style.setProperty(`--${c[0]}`, c[1])
  )
}

const plotEstacoesMap = (state) => {
  const formatText = (e) => {
    return `Código:${e.CD_ESTACAO} Situação:${e.CD_SITUACAO}`
  }
  const { ESTACOES, ESTACAO } = state
  const estacao = ESTACOES.filter(e => e.CD_ESTACAO === ESTACAO[0])[0]

  const estacoesOperante = ESTACOES.filter(e => e.CD_SITUACAO === 'Operante')
  const estacoesInoperante = ESTACOES.filter(e => e.CD_SITUACAO !== 'Operante')

  const data = [
    {
      name: '',
      type: 'scattermapbox',
      text: estacoesOperante.map(formatText),
      lon: estacoesOperante.map(e => e.VL_LONGITUDE),
      lat: estacoesOperante.map(e => e.VL_LATITUDE),
      marker: { color: CORES.azul_pantone, size: 9 }
    },
    {
      name: '',
      type: 'scattermapbox',
      text: estacoesInoperante.map(formatText),
      lon: estacoesInoperante.map(e => e.VL_LONGITUDE),
      lat: estacoesInoperante.map(e => e.VL_LATITUDE),
      marker: { color: CORES.laranja_chama, size: 9 }
    },
    {
      name: 'Estação escolhida',
      type: 'scattermapbox',
      text: [formatText(estacao)],
      lon: [estacao.VL_LONGITUDE],
      lat: [estacao.VL_LATITUDE],
      marker: { color: CORES.verde, size: 20 }
    }
  ]

  const layout = {
    showlegend: false,
    dragmode: 'zoom',
    mapbox: { style: 'open-street-map', center: { lat: -16, lon: -60 }, zoom: 3 },
    margin: { r: 0, t: 0, b: 0, l: 0 }
  }

  Plotly.newPlot('mapPlot', data, layout, { responsive: true })
}

const bindEvents = () => {
  const [_update, _subscribe] = store()
  update = _update
  subscribe = _subscribe
  // subscribe(e => console.log('New state:', e), ALL)

  storeEstacoes(update)

  const date = new Date()
  date.setHours(-24)
  const dtFin = date.toISOString().split('T')[0]
  date.setHours(-24 * 8)
  const dtIn = date.toISOString().split('T')[0]

  dateIn.value = dtIn
  dateFin.value = dtFin
  const defaultEstacao = 'A756'

  storeHorario(defaultEstacao, dtIn, dtFin, update)
  subscribe(renderEstacaoSelect, ['ESTACOES'])
  subscribe(plotEstacoesMap, ['ESTACOES', 'ESTACAO'])
  subscribe(handleMeasurementsOptions, ['measurementType'])
  subscribe(handleMeasurementsVars, ['measurementVars'])
  subscribe(plotLineGraph1, ['measurementVars', 'MEDICOES', 'measurementType'])
  subscribe(plotLineGraph2, ['measurementVars', 'MEDICOES', 'measurementType'])
  subscribe(plotScatterLine, ['measurementVars', 'MEDICOES', 'measurementType'])
  subscribe(renderDataTable, ['measurementVars', 'MEDICOES'])
  update([defaultEstacao], 'ESTACAO', BULK_REPLACE)
  update([dtIn, dtFin], 'DATE', ADD)
  update(['horario'], 'measurementType', BULK_REPLACE)
  update(['VEN_VEL', 'TEM_INS'], 'measurementVars', BULK_REPLACE)

  mainForm.addEventListener('submit', handleSubmit)
  measurementTypeA.addEventListener('change', handleMeasurementsVarsChange)
  measurementTypeB.addEventListener('change', handleMeasurementsVarsChange)
  estacaoId.addEventListener('change', handleEstacaoIdChange)

}


module.exports = { variancia, desvio_padrao, covar, rmse, linear_reg, predict, pearson_corr };