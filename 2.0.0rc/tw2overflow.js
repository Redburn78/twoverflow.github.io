/**
 * https://github.com/tsironis/lockr
 */
;(function(root, factory) {
    define('Lockr', factory(root, {}))
}(this, function(root, Lockr) {
    'use strict'

    Lockr.prefix = ''

    Lockr._getPrefixedKey = function(key, options) {
        options = options || {}

        if (options.noPrefix) {
            return key
        } else {
            return this.prefix + key
        }

    }

    Lockr.set = function(key, value, options) {
        var query_key = this._getPrefixedKey(key, options)

        try {
            localStorage.setItem(query_key, JSON.stringify({
                data: value
            }))
        } catch (e) {}
    }

    Lockr.get = function(key, missing, options) {
        var query_key = this._getPrefixedKey(key, options),
            value

        try {
            value = JSON.parse(localStorage.getItem(query_key))
        } catch (e) {
            if (localStorage[query_key]) {
                value = {
                    data: localStorage.getItem(query_key)
                }
            } else {
                value = null
            }
        }
        
        if (value === null) {
            return missing
        } else if (typeof value === 'object' && typeof value.data !== 'undefined') {
            return value.data
        } else {
            return missing
        }
    }

    return Lockr
}))

/*!
 * TWOverflow v2.0.0rc
 *
 * Copyright (C) 2019 Relaxeaza
 * This work is free. You can redistribute it and/or modify it under the
 * terms of the Do What The Fuck You Want To Public License, Version 2,
 * as published by Sam Hocevar. See the LICENCE file for more details.
 */

;(function (window, undefined) {

var $rootScope = injector.get('$rootScope')
var transferredSharedDataService = injector.get('transferredSharedDataService')
var modelDataService = injector.get('modelDataService')
var socketService = injector.get('socketService')
var routeProvider = injector.get('routeProvider')
var eventTypeProvider = injector.get('eventTypeProvider')
var windowDisplayService = injector.get('windowDisplayService')
var windowManagerService = injector.get('windowManagerService')
var angularHotkeys = injector.get('hotkeys')
var armyService = injector.get('armyService')
var villageService = injector.get('villageService')
var mapService = injector.get('mapService')
var $filter = injector.get('$filter')
var $timeout = injector.get('$timeout')
var storageService = injector.get('storageService')

define('two/eventQueue', function () {
    /**
     * Callbacks usados pelos eventos que são disparados no decorrer do script.
     *
     * @type {Object}
     */
    var eventListeners = {}

    /**
     * Métodos públicos do eventQueue.
     *
     * @type {Object}
     */
    var eventQueue = {}

    /**
     * Registra um evento.
     *
     * @param {String} event - Nome do evento.
     * @param {Function} handler - Função chamada quando o evento for disparado.
     */
    eventQueue.bind = function (event, handler) {
        if (!eventListeners.hasOwnProperty(event)) {
            eventListeners[event] = []
        }

        eventListeners[event].push(handler)
    }

    /**
     * Chama os eventos.
     *
     * @param {String} event - Nome do evento.
     * @param {Array} args - Argumentos que serão passados no callback.
     */
    eventQueue.trigger = function (event, args) {
        if (eventListeners.hasOwnProperty(event)) {
            eventListeners[event].forEach(function (handler) {
                handler.apply(this, args)
            })
        }
    }

    return eventQueue
})

define('two/EventScope', [
    'queues/EventQueue'
], function (eventQueue) {
    var EventScope = function (windowId, onDestroy) {
        if (typeof windowId === 'undefined') {
            throw new Error('EventScope: no windowId')
        }

        this.windowId = windowId
        this.onDestroy = onDestroy || function () {}
        this.listeners = []

        var unregister = $rootScope.$on(eventTypeProvider.WINDOW_CLOSED, (event, templateName) => {
            if (templateName === '!' + this.windowId) {
                this.destroy()
                unregister()
            }
        })
    }

    EventScope.prototype.register = function (id, handler, _root) {
        if (_root) {
            this.listeners.push($rootScope.$on(id, handler))
        } else {
            eventQueue.register(id, handler)
            
            this.listeners.push(function () {
                eventQueue.unregister(id, handler)
            })
        }
    }

    EventScope.prototype.destroy = function () {
        this.listeners.forEach((unregister) => {
            unregister()
            this.onDestroy()
        })
    }

    return EventScope
})
define('two/utils', [
    'helper/time'
], function ($timeHelper) {
    var notifTimeout = null
    var utils = {}

    /**
     * Gera um número aleatório aproximado da base.
     *
     * @param {Number} base - Número base para o calculo.
     */
    utils.randomSeconds = function (base) {
        base = parseInt(base, 10)

        var max = base + (base / 2)
        var min = base - (base / 2)

        return Math.round(Math.random() * (max - min) + min)
    }

    /**
     * Converte uma string com um tempo em segundos.
     *
     * @param {String} time - Tempo que será convertido (hh:mm:ss)
     */
    utils.time2seconds = function (time) {
        time = time.split(':')
        time[0] = parseInt(time[0], 10) * 60 * 60
        time[1] = parseInt(time[1], 10) * 60
        time[2] = parseInt(time[2], 10)

        return time.reduce(function (a, b) {
            return a + b
        })
    }

    /**
     * Emite notificação nativa do jogo.
     *
     * @param {String} type - success || error
     * @param {String} message - Texto a ser exibido
     */
    utils.emitNotif = function (type, message) {
        var eventType = type === 'success'
            ? eventTypeProvider.MESSAGE_SUCCESS
            : eventTypeProvider.MESSAGE_ERROR

        $rootScope.$broadcast(eventType, {
            message: message
        })
    }


    /**
     * Gera uma string com nome e coordenadas da aldeia
     *
     * @param {Object} village - Dados da aldeia
     * @return {String}
     */
    utils.genVillageLabel = function (village) {
        return village.name + ' (' + village.x + '|' + village.y + ')'
    }

    /**
     * Verifica se uma coordenada é válida.
     * 00|00
     * 000|00
     * 000|000
     * 00|000
     *
     * @param {String} xy - Coordenadas
     * @return {Boolean}
     */
    utils.isValidCoords = function (xy) {
        return /\s*\d{2,3}\|\d{2,3}\s*/.test(xy)
    }

    /**
     * Validação de horario e data de envio. Exmplo: 23:59:00:999 30/12/2016
     *
     * @param  {String}  dateTime
     * @return {Boolean}
     */
    utils.isValidDateTime = function (dateTime) {
        return /^\s*([01][0-9]|2[0-3]):[0-5]\d:[0-5]\d(:\d{1,3})? (0[1-9]|[12][0-9]|3[0-1])\/(0[1-9]|1[0-2])\/\d{4}\s*$/.test(dateTime)
    }

    /**
     * Inverte a posição do dia com o mês.
     */
    utils.fixDate = function (dateTime) {
        var dateAndTime = dateTime.split(' ')
        var time = dateAndTime[0]
        var date = dateAndTime[1].split('/')

        return time + ' ' + date[1] + '/' + date[0] + '/' + date[2]
    }

    /**
     * Gera um id unico
     *
     * @return {String}
     */
    utils.guid = function () {
        return Math.floor((Math.random()) * 0x1000000).toString(16)
    }

    /**
     * Verifica se um elemento é pertencente a outro elemento.
     *
     * @param  {Element} elem - Elemento referencia
     * @param  {String} selector - Selector CSS do elemento no qual será
     *   será verificado se tem relação com o elemento indicado.
     * @return {Boolean}
     */
    utils.matchesElem = function (elem, selector) {
        if ($(elem).parents(selector).length) {
            return true
        }

        return false
    }

    /**
     * Obtem o timestamp de uma data em string.
     * Formato da data: mês/dia/ano
     * Exmplo de entrada: 23:59:59:999 12/30/2017
     *
     * @param  {String} dateString - Data em formato de string.
     * @return {Number} Timestamp (milisegundos)
     */
    utils.getTimeFromString = function (dateString, offset) {
        var dateSplit = dateString.trim().split(' ')
        var time = dateSplit[0].split(':')
        var date = dateSplit[1].split('/')

        var hour = time[0]
        var min = time[1]
        var sec = time[2]
        var ms = time[3] || null

        var month = parseInt(date[0], 10) - 1
        var day = date[1]
        var year = date[2]

        var date = new Date(year, month, day, hour, min, sec, ms)

        return date.getTime() + (offset || 0)
    }

    /**
     * Formata milisegundos em hora/data
     *
     * @return {String} Data e hora formatada
     */
    utils.formatDate = function (ms, format) {
        return $filter('readableDateFilter')(
            ms,
            null,
            $rootScope.GAME_TIMEZONE,
            $rootScope.GAME_TIME_OFFSET,
            format || 'HH:mm:ss dd/MM/yyyy'
        )
    }

    /**
     * Obtem a diferença entre o timezone local e do servidor.
     *
     * @type {Number}
     */
    utils.getTimeOffset = function () {
        var localDate = $timeHelper.gameDate()
        var localOffset = localDate.getTimezoneOffset() * 1000 * 60
        var serverOffset = $rootScope.GAME_TIME_OFFSET

        return localOffset + serverOffset
    }

    utils.xhrGet = function (url, _callback, _dataType) {
        if (!url) {
            return false
        }

        _dataType = _dataType || 'text'
        _callback = _callback || function () {}

        var xhr

        xhr = new XMLHttpRequest()
        xhr.open('GET', url, true)
        xhr.responseType = _dataType
        xhr.addEventListener('load', function () {
            _callback(xhr.response)
        }, false)

        xhr.send()
    }

    utils.obj2selectOptions = function (obj, _includeIcon) {
        var list = []
        var item
        var i

        for (i in obj) {
            item = {
                name: obj[i].name,
                value: obj[i].id
            }

            if (_includeIcon) {
                item.leftIcon = obj[i].icon
            }

            list.push(item)
        }

        return list
    }

    return utils
})

define('two/ready', [
    'conf/gameStates'
], function (
    GAME_STATES
) {
    var ready = function (callback, which) {
        which = which || ['map']

        var readyStep = function (item) {
            which = which.filter(function (_item) {
                return _item !== item
            })

            if (!which.length) {
                callback()
            }
        }

        var handlers = {
            'map': function () {
                var mapScope = transferredSharedDataService.getSharedData('MapController')

                if (mapScope.isInitialized) {
                    return readyStep('map')
                }

                $rootScope.$on(eventTypeProvider.MAP_INITIALIZED, function () {
                    readyStep('map')
                })
            },
            'tribe_relations': function () {
                var $player = modelDataService.getSelectedCharacter()

                if ($player) {
                    var $tribeRelations = $player.getTribeRelations()

                    if (!$player.getTribeId() || $tribeRelations) {
                        return readyStep('tribe_relations')
                    }
                }

                var unbind = $rootScope.$on(eventTypeProvider.TRIBE_RELATION_LIST, function () {
                    unbind()
                    readyStep('tribe_relations')
                })
            },
            'initial_village': function () {
                var $gameState = modelDataService.getGameState()

                if ($gameState.getGameState(GAME_STATES.INITIAL_VILLAGE_READY)) {
                    return readyStep('initial_village')
                }

                $rootScope.$on(eventTypeProvider.GAME_STATE_INITIAL_VILLAGE_READY, function () {
                    readyStep('initial_village')
                })
            },
            'all_villages_ready': function () {
                var $gameState = modelDataService.getGameState()

                if ($gameState.getGameState(GAME_STATES.ALL_VILLAGES_READY)) {
                    return readyStep('all_villages_ready')
                }

                $rootScope.$on(eventTypeProvider.GAME_STATE_ALL_VILLAGES_READY, function () {
                    readyStep('all_villages_ready')
                })
            }
        }

        var mapScope = transferredSharedDataService.getSharedData('MapController')

        if (!mapScope) {
            return setTimeout(function () {
                ready(callback, which)
            }, 100)
        }

        which.forEach(function (readyItem) {
            handlers[readyItem]()
        })
    }

    return ready
})

require([
    'two/ready',
    'Lockr'
], function (
    ready,
    Lockr
) {
    ready(function () {
        var $player = modelDataService.getSelectedCharacter()

        // Lockr settings
        Lockr.prefix = $player.getId() + '_twOverflow_' + $player.getWorldId() + '-'
    })
})

require([
    'helper/i18n',
    'two/ready'
], function (
    i18n,
    ready
) {
    var updateModuleLang = function () {
        var langs = {"en_us":{"common":{"start":"Start","started":"Started","pause":"Pause","paused":"Paused","stop":"Stop","stopped":"Stopped","status":"Status","none":"None","info":"Information","settings":"Settings","others":"Others","village":"Village","villages":"Villages","building":"Building","buildings":"Buildings","level":"Level","registers":"Registers","filters":"Filters","add":"Add","waiting":"Waiting","attack":"Attack","support":"Support","relocate":"Transfer","activate":"Enable","deactivate":"Disable","units":"Units","officers":"Officers","origin":"Origin","target":"Target","save":"Save","logs":"Logs","headquarter":"Headquarters","barracks":"Barracks","tavern":"Tavern","hospital":"Hospital","preceptory":"Hall of Orders","chapel":"Chapel","church":"Church","academy":"Academy","rally_point":"Rally Point","statue":"Statue","market":"Market","timber_camp":"Timber Camp","clay_pit":"Clay Pit","iron_mine":"Iron Mine","farm":"Farm","warehouse":"Warehouse","wall":"Wall","spear":"Spearman","sword":"Swordsman","axe":"Axe Fighter","archer":"Archer","light_cavalry":"Light Cavalry","mounted_archer":"Mounted Archer","heavy_cavalry":"Heavy Cavalry","ram":"Ram","catapult":"Catapult","doppelsoldner":"Berserker","trebuchet":"Trebuchet","snob":"Nobleman","knight":"Paladin","no-results":"No results...","selected":"Selected","now":"Now","costs":"Costs","duration":"Duration","points":"Points","player":"Player","players":"Players","next_features":"Next features","misc":"Miscellaneous","colors":"Colors","reset":"Reset","here":"here","disabled":"— Disabled —","cancel":"Cancel","actions":"Actions","remove":"Remove"}},"pl_pl":{"common":{"start":"Start","started":"Uruchomiony","pause":"Pauza","paused":"Wstrzymany","stop":"Zatrzymany","stopped":"Zatrzymany","status":"Status","none":"Żaden","info":"Informacje","settings":"Ustawienia","others":"Inne","village":"Wioska","villages":"Wioski","building":"Budynek","buildings":"Budynki","level":"Poziom","registers":"Rejestry","filters":"Filtry","add":"Dodaj","waiting":"Oczekujące","attack":"Atak","support":"Wsparcie","relocate":"Przeniesienie","activate":"Włącz","deactivate":"Wyłącz","units":"Jednostki","officers":"Oficerowie","origin":"Źródło","target":"Cel","save":"Zapisz","logs":"Logi","headquarter":"Ratusz","barracks":"Koszary","tavern":"Tawerna","hospital":"Szpital","preceptory":"Komturia","chapel":"Kaplica","church":"Kościół","academy":"Akademia","rally_point":"Plac","statue":"Piedestał","market":"Rynek","timber_camp":"Tartak","clay_pit":"Kopalnia gliny","iron_mine":"Huta żelaza","farm":"Farma","warehouse":"Magazyn","wall":"Mur","spear":"Pikinier","sword":"Miecznik","axe":"Topornik","archer":"Łucznik","light_cavalry":"Lekki kawalerzysta","mounted_archer":"Łucznik konny","heavy_cavalry":"Ciężki kawalerzysta","ram":"Taran","catapult":"Katapulta","doppelsoldner":"Berserker","trebuchet":"Trebusz","snob":"Szlachcic","knight":"Rycerz","no-results":"Brak wyników...","selected":"Wybrana","now":"Teraz","costs":"Koszty","duration":"Czas trwania","points":"Punkty","player":"Gracz","players":"Gracze","next_features":"Następne funkcje","misc":"Różne","colors":"Kolory","reset":"Reset","here":"here","disabled":"— Wyłączony —","cancel":"Cancel","actions":"Actions","remove":"Remove"}},"pt_br":{"common":{"start":"Iniciar","started":"Iniciado","pause":"Pausar","paused":"Pausado","stop":"Parar","stopped":"Parado","status":"Status","none":"Nenhum","info":"Informações","settings":"Configurações","others":"Outros","village":"Aldeia","villages":"Aldeias","building":"Edifício","buildings":"Edifícios","level":"Nível","registers":"Registros","filters":"Filtros","add":"Adicionar","waiting":"Em espera","attack":"Ataque","support":"Apoio","relocate":"Transferência","activate":"Ativar","deactivate":"Desativar","units":"Unidades","officers":"Oficiais","origin":"Origem","target":"Alvo","save":"Salvar","logs":"Eventos","headquarter":"Edifício Principal","barracks":"Quartel","tavern":"Taverna","hospital":"Hospital","preceptory":"Salão das Ordens","chapel":"Capela","church":"Igreja","academy":"Academia","rally_point":"Ponto de Encontro","statue":"Estátua","market":"Mercado","timber_camp":"Bosque","clay_pit":"Poço de Argila","iron_mine":"Mina de Ferro","farm":"Fazenda","warehouse":"Armazém","wall":"Muralha","spear":"Lanceiro","sword":"Espadachim","axe":"Viking","archer":"Arqueiro","light_cavalry":"Cavalaria Leve","mounted_archer":"Arqueiro Montado","heavy_cavalry":"Cavalaria Pesada","ram":"Aríete","catapult":"Catapulta","doppelsoldner":"Berserker","trebuchet":"Trabuco","snob":"Nobre","knight":"Paladino","no-results":"Sem resultados...","selected":"Selecionado","now":"Agora","costs":"Custos","duration":"Duração","points":"Pontos","player":"Jogador","players":"Jogadores","next_features":"Próximas funcionalidades","misc":"Diversos","colors":"Cores","reset":"Resetar","here":"aqui","disabled":"— Desativado —","cancel":"Cancelar","actions":"Ações","remove":"Remover"}}}
        var current = $rootScope.loc.ale

        var data = current in langs
            ? langs[current]
            : langs['en_us']

        i18n.setJSON(data)
    }

    ready(function () {
        updateModuleLang()
    })
})

define('two/attackView', [
    'two/queue',
    'two/eventQueue',
    'two/ready',
    'models/CommandModel',
    'conf/unitTypes',
    'Lockr',
    'helper/math',
    'helper/mapconvert',
    'struct/MapData'
], function (
    Queue,
    eventQueue,
    ready,
    CommandModel,
    UNIT_TYPES,
    Lockr,
    $math,
    $convert,
    $mapData
) {
    var COLUMN_TYPES = {
        'ORIGIN_VILLAGE'    : 'origin_village_name',
        'COMMAND_TYPE'      : 'command_type',
        'TARGET_VILLAGE'    : 'target_village_name',
        'TIME_COMPLETED'    : 'time_completed',
        'COMMAND_PROGRESS'  : 'command_progress',
        'ORIGIN_CHARACTER'  : 'origin_character_name'
    }
    var COMMAND_TYPES = {
        'ATTACK': 'attack',
        'SUPPORT': 'support',
        'RELOCATE': 'relocate'
    }
    var COMMAND_ORDER = [
        'ATTACK',
        'SUPPORT',
        'RELOCATE'
    ]
    var FILTER_TYPES = {
        'COMMAND_TYPES'     : 'commandTypes',
        'VILLAGE'           : 'village',
        'INCOMING_UNITS'    : 'incomingUnits'
    }
    var UNIT_SPEED_ORDER = [
        UNIT_TYPES.LIGHT_CAVALRY,
        UNIT_TYPES.HEAVY_CAVALRY,
        UNIT_TYPES.AXE,
        UNIT_TYPES.SWORD,
        UNIT_TYPES.RAM,
        UNIT_TYPES.SNOB,
        UNIT_TYPES.TREBUCHET
    ]
    var INCOMING_UNITS_FILTER = {}

    for (var i = 0; i < UNIT_SPEED_ORDER.length; i++) {
        INCOMING_UNITS_FILTER[UNIT_SPEED_ORDER[i]] = true
    }

    var resetFilters = function () {
        filters = {}
        filters[FILTER_TYPES.COMMAND_TYPES] = angular.copy(COMMAND_TYPES)
        filters[FILTER_TYPES.VILLAGE] = false
        filters[FILTER_TYPES.INCOMING_UNITS] = angular.copy(INCOMING_UNITS_FILTER)
    }

    var initialized = false
    var listeners = {}
    var overviewService = injector.get('overviewService')
    var globalInfoModel
    var commands = []
    var filters = {}
    var params = {}
    var sorting = {
        reverse: false,
        column: COLUMN_TYPES.COMMAND_PROGRESS
    }

    var formatFilters = function formatFilters () {
        var toArray = [FILTER_TYPES.COMMAND_TYPES]
        var currentVillageId = modelDataService.getSelectedVillage().getId()
        var arrays = {}
        var i
        var j

        // format filters for backend
        for (i = 0; i < toArray.length; i++) {
            for (j in filters[toArray[i]]) {
                if (!arrays[toArray[i]]) {
                    arrays[toArray[i]] = []
                }

                if (filters[toArray[i]][j]) {
                    switch (toArray[i]) {
                    case FILTER_TYPES.COMMAND_TYPES:
                        if (j === 'ATTACK') {
                            arrays[toArray[i]].push(COMMAND_TYPES.ATTACK)
                        } else if (j === 'SUPPORT') {
                            arrays[toArray[i]].push(COMMAND_TYPES.SUPPORT)
                        } else if (j === 'RELOCATE') {
                            arrays[toArray[i]].push(COMMAND_TYPES.RELOCATE)
                        }
                        break
                    }
                }
            }
        }

        params = arrays
        params.village = filters[FILTER_TYPES.VILLAGE] ? [currentVillageId] : []
    }

    /**
     * Toggles the given filter.
     *
     * @param {string} type The category of the filter (see FILTER_TYPES)
     * @param {string} opt_filter The filter to be toggled.
     */
    var toggleFilter = function (type, opt_filter) {
        if (!opt_filter) {
            filters[type] = !filters[type]
        } else {
            filters[type][opt_filter] = !filters[type][opt_filter]
        }

        // format filters for the backend
        formatFilters()

        eventQueue.trigger('attackView/filtersChanged')
    }

    var toggleSorting = function (newColumn) {
        if (!COLUMN_TYPES[newColumn]) {
            return false
        }

        if (COLUMN_TYPES[newColumn] === sorting.column) {
            sorting.reverse = !sorting.reverse
        } else {
            sorting.column = COLUMN_TYPES[newColumn]
            sorting.reverse = false
        }

        eventQueue.trigger('attackView/sortingChanged')
    }

    /**
     * Command was sent.
     */
    var onCommandIncomming = function () {
        // we can never know if the command is currently visible (because of filters, sorting and stuff) -> reload
        loadCommands()
    }

    /**
     * Command was cancelled.
     *
     * @param {Object} event unused
     * @param {Object} data The backend-data
     */
    var onCommandCancelled = function (event, data) {
        eventQueue.trigger('attackView/commandCancelled', [data.id || data.command_id])
    }

    /**
     * Command ignored.
     *
     * @param {Object} event unused
     * @param {Object} data The backend-data
     */
    var onCommandIgnored = function (event, data) {
        for (var i = 0; i < commands.length; i++) {
            if (commands[i].command_id === data.command_id) {
                commands.splice(i, 1)
            }
        }

        eventQueue.trigger('attackView/commandIgnored', [data.command_id])
    }

    /**
     * Village name changed.
     *
     * @param {Object} event unused
     * @param {Object} data The backend-data
     */
    var onVillageNameChanged = function (event, data) {
        for (var i = 0; i < commands.length; i++) {
            if (commands[i].target_village_id === data.village_id) {
                commands[i].target_village_name = data.name
                commands[i].targetVillage.name = data.name
            }
        }

        eventQueue.trigger('attackView/villageRenamed', [data])
    }

    var onVillageSwitched = function (e, newVillageId) {
        if (params[FILTER_TYPES.VILLAGE].length) {
            params[FILTER_TYPES.VILLAGE] = [newVillageId]

            loadCommands()
        }
    }

    var onFiltersChanged = function () {
        Lockr.set('attackView-filters', filters)

        loadCommands()
    }

    var onSortingChanged = function () {
        loadCommands()
    }

    /**
     * @param {Object} data The data-object from the backend
     */
    var onOverviewIncomming = function onOverviewIncomming (data) {
        commands = data.commands

        for (var i = 0; i < commands.length; i++) {
            overviewService.formatCommand(commands[i])
            commands[i].slowestUnit = getSlowestUnit(commands[i])
        }

        commands = commands.filter(function (command) {
            return filters[FILTER_TYPES.INCOMING_UNITS][command.slowestUnit]
        })

        eventQueue.trigger('attackView/commandsLoaded', [commands])
    }

    var loadCommands = function () { 
        var incomingCommands = globalInfoModel.getCommandListModel().getIncomingCommands().length
        var count = incomingCommands > 25 ? incomingCommands : 25

        socketService.emit(routeProvider.OVERVIEW_GET_INCOMING, {
            'count'         : count,
            'offset'        : 0,
            'sorting'       : sorting.column,
            'reverse'       : sorting.reverse ? 1 : 0,
            'groups'        : [],
            'command_types' : params[FILTER_TYPES.COMMAND_TYPES],
            'villages'      : params[FILTER_TYPES.VILLAGE]
        }, onOverviewIncomming)
    }

    /**
     * @param {CommandModel} command
     * @return {String} Slowest unit
     */
    var getSlowestUnit = function (command) {
        var commandDuration = command.model.duration
        var units = {}
        var origin = { x: command.origin_x, y: command.origin_y }
        var target = { x: command.target_x, y: command.target_y }
        var travelTimes = []

        UNIT_SPEED_ORDER.forEach(function (unit) {
            units[unit] = 1
            
            travelTimes.push({
                unit: unit,
                duration: Queue.getTravelTime(origin, target, units, command.command_type, {})
            })
        })

        travelTimes = travelTimes.map(function (travelTime) {
            travelTime.duration = Math.abs(travelTime.duration - commandDuration)
            return travelTime
        }).sort(function (a, b) {
            return a.duration - b.duration
        })

        return travelTimes[0].unit
    }

    var getCommands = function () {
        return commands
    }

    var getFilters = function () {
        return filters
    }

    var getSortings = function () {
        return sorting
    }

    var registerListeners = function () {
        listeners[eventTypeProvider.COMMAND_INCOMING] = rootScope.$on(eventTypeProvider.COMMAND_INCOMING, onCommandIncomming)
        listeners[eventTypeProvider.COMMAND_CANCELLED] = rootScope.$on(eventTypeProvider.COMMAND_CANCELLED, onCommandCancelled)
        listeners[eventTypeProvider.MAP_SELECTED_VILLAGE] = rootScope.$on(eventTypeProvider.MAP_SELECTED_VILLAGE, onVillageSwitched)
        listeners[eventTypeProvider.VILLAGE_NAME_CHANGED] = rootScope.$on(eventTypeProvider.VILLAGE_NAME_CHANGED, onVillageNameChanged)
        listeners[eventTypeProvider.COMMAND_IGNORED] = rootScope.$on(eventTypeProvider.COMMAND_IGNORED, onCommandIgnored)
    }

    var unregisterListeners = function () {
        for (var event in listeners) {
            listeners[event]()
        }
    }

    /**
     * Sort a set of villages by distance from a specified village.
     *
     * @param {Array[{x: Number, y: Number}]} villages List of village that will be sorted.
     * @param {VillageModel} origin
     * @return {Array} Sorted villages
     */
    var sortByDistance = function (villages, origin) {
        return villages.sort(function (villageA, villageB) {
            var distA = $math.actualDistance(origin, villageA)
            var distB = $math.actualDistance(origin, villageB)

            return distA - distB
        })
    }

    /**
     * Order:
     * - Barbarian villages.
     * - Own villages.
     * - Tribe villages.
     *
     * @param {VillageModel} origin
     * @param {Function} callback
     */
    var closestNonHostileVillage = function (origin, callback) {
        var size = 25

        if ($mapData.hasTownDataInChunk(origin.x, origin.y)) {
            var sectors = $mapData.loadTownData(origin.x, origin.y, size, size, size)
            var targets = []
            var possibleTargets = []
            var closestTargets
            var barbs = []
            var own = []
            var tribe = []
            var x
            var y
            var tribeId = modelDataService.getSelectedCharacter().getTribeId()
            var playerId = modelDataService.getSelectedCharacter().getId()

            sectors.forEach(function (sector) {
                for (x in sector.data) {
                    for (y in sector.data[x]) {
                        targets.push(sector.data[x][y])
                    }
                }
            })


            barbs = targets.filter(function (target) {
                return target.character_id === null && target.id > 0
            })

            own = targets.filter(function (target) {
                return target.character_id === playerId && origin.id !== target.id
            })

            if (tribeId) {
                tribe = targets.filter(function (target) {
                    return tribeId && target.tribe_id === tribeId
                })
            }

            if (barbs.length) {
                closestTargets = sortByDistance(barbs, origin)
            } else if (own.length) {
                closestTargets = sortByDistance(own, origin)
            } else if (tribe.length) {
                closestTargets = sortByDistance(tribe, origin)
            } else {
                return callback(false)
            }

            return callback(closestTargets[0])
        }
        
        var loads = $convert.scaledGridCoordinates(origin.x, origin.y, size, size, size)
        var index = 0

        $mapData.loadTownDataAsync(origin.x, origin.y, size, size, function () {
            if (++index === loads.length) {
                closestNonHostileVillage(origin, callback)
            }
        })
    }

    /**
     * Set an automatic command with all units from the village
     * and start the CommandQueue module if it's disabled.
     *
     * @param {Object} command Data of the command like origin, target.
     * @param {String} date Date that the command has to leave.
     */
    var setQueueCommand = function (command, date) {
        closestNonHostileVillage(command.targetVillage, function (closestVillage) {
            var origin = command.targetVillage
            var target = closestVillage
            var type = target.character_id === null ? 'attack' : 'support'
            
            Queue.addCommand({
                origin: origin,
                target: target,
                date: date,
                dateType: 'out',
                units: {
                    spear: '*',
                    sword: '*',
                    axe: '*',
                    archer: '*',
                    light_cavalry: '*',
                    mounted_archer: '*',
                    heavy_cavalry: '*',
                    ram: '*',
                    catapult: '*',
                    snob: '*',
                    knight: '*',
                    doppelsoldner: '*',
                    trebuchet: '*'
                },
                officers: {},
                type: type,
                catapultTarget: 'wall'
            })

            if (!Queue.isRunning()) {
                Queue.start()
            }
        })
    }

    var init = function () {
        Locale.create('attackView', {"en":{"title":"AttackView","filters.tooltip.current-only":"Current village only","filters.types":"Types","filters.tooltip.show-attacks":"Show attacks","filters.tooltip.show-supports":"Show supports","filters.tooltip.show-relocations":"Show relocations","filters.incoming-units":"Incoming Units","tooltip.command-type":"Command Type","tooltip.slowest-unit":"Slowest Unit","command-type":"CT","slowest-unit":"SU","actions":"Actions","no-incoming":"No commands incoming.","commands.tooltip.copy-arrival":"Copy arrival date.","commands.tooltip.copy-back":"Copy backtime date.","commands.tooltip.set-remove":"Set a CommandQueue to remove all troops before the attack hit."},"pl":{"title":"Strażnik","filters.tooltip.current-only":"Tylko aktywna wioska","filters.types":"Rodzaj","filters.tooltip.show-attacks":"Pokaż ataki","filters.tooltip.show-supports":"Pokaż wsparcia","filters.tooltip.show-relocations":"Pokaż przeniesienia","filters.incoming-units":"Nadchodzące jednostki","tooltip.command-type":"Rodzaj","tooltip.slowest-unit":"Najwolniejsza jednostka","command-type":"Rodzaj","slowest-unit":"Co?","actions":"Dostępne akcje","no-incoming":"Brak nadchodzących wojsk.","commands.tooltip.copy-arrival":"Kopiuj czas dotarcia.","commands.tooltip.copy-back":"Kopiuj czas powrotu do wioski źródłowej.","commands.tooltip.set-remove":"Wstaw rozkaz wycofania wojsk przed dotarciem ataku do Kolejki rozkazów."},"pt":{"title":"AttackView","filters.tooltip.current-only":"Apenas aldeia selecionada","filters.types":"Tipos","filters.tooltip.show-attacks":"Mostrar ataques","filters.tooltip.show-supports":"Mostrar apoios","filters.tooltip.show-relocations":"Mostrar transferências","filters.incoming-units":"Unidades Chegando","tooltip.command-type":"Tipo de Comando","tooltip.slowest-unit":"Unidade mais Lenta","command-type":"TC","slowest-unit":"UL","actions":"Ações","no-incoming":"Nenhum comando chegando.","commands.tooltip.copy-arrival":"Copiar data de chegada.","commands.tooltip.copy-back":"Copiar backtime.","commands.tooltip.set-remove":"Criar um comando no CommandQueue para remover todas tropas da aldeia antes do comando bater na aldeia."}}, 'en')
        
        var defaultFilters = {}
        defaultFilters[FILTER_TYPES.COMMAND_TYPES] = angular.copy(COMMAND_TYPES)
        defaultFilters[FILTER_TYPES.INCOMING_UNITS] = angular.copy(INCOMING_UNITS_FILTER)
        defaultFilters[FILTER_TYPES.VILLAGE] = false

        initialized = true
        globalInfoModel = modelDataService.getSelectedCharacter().getGlobalInfo()
        filters = Lockr.get('attackView-filters', {}, true)
        angular.merge(filters, defaultFilters)

        ready(function () {
            formatFilters()
        }, ['initial_village'])

        eventQueue.bind('attackView/filtersChanged', onFiltersChanged)
        eventQueue.bind('attackView/sortingChanged', onSortingChanged)
    }

    return {
        init: init,
        version: '1.0.0',
        loadCommands: loadCommands,
        getCommands: getCommands,
        getFilters: getFilters,
        getSortings: getSortings,
        toggleFilter: toggleFilter,
        toggleSorting: toggleSorting,
        FILTER_TYPES: FILTER_TYPES,
        COMMAND_TYPES: COMMAND_TYPES,
        UNIT_SPEED_ORDER: UNIT_SPEED_ORDER,
        COLUMN_TYPES: COLUMN_TYPES,
        registerListeners: registerListeners,
        unregisterListeners: unregisterListeners,
        setQueueCommand: setQueueCommand
    }
})

require([
    'two/ready',
    'two/attackView',
    'two/attackView/ui'
], function (
    ready,
    attackView
) {
    if (attackView.initialized) {
        return false
    }

    ready(function () {
        attackView.init()
        attackView.interface()
    })
})

define('two/attackView/ui', [
    'two/attackView',
    'two/queue',
    'two/ui',
    'two/FrontButton',
    'two/utils',
    'two/eventQueue',
    'helper/time',
    'conf/unitTypes',
    'ejs'
], function (
    attackView,
    Queue,
    Interface,
    FrontButton,
    utils,
    eventQueue,
    $timeHelper,
    UNIT_TYPES,
    ejs
) {
    var ui
    var opener
    var $window
    var $commands
    var $empty
    var $filters
    var $filtersBase
    var $sortings
    
    var init = function () {
        ui = new Interface('AttackView', {
            template: '<div class="win-content message-list-wrapper searchable-list ng-scope"><header class="win-head"><h2><#= locale("attackView", "title") #> <span class="small">v<#= version #></span></h2><ul class="list-btn"><li><a href="#" class="twOverflow-close size-34x34 btn-red icon-26x26-close"></a></li></ul></header><div class="win-main"><div class="box-paper"><div class="filters"><table class="tbl-border-light"><tbody><tr><th><#= locale("common", "village") #></th></tr><tr><td><div class="box-border-dark icon village" tooltip="<#= locale("attackView", "filters.tooltip.current-only") #>"><span class="icon-34x34-village-info icon-bg-black"></span></div></td></tr></tbody></table><table class="tbl-border-light"><tbody><tr><th><#= locale("attackView", "filters.types") #></th></tr><tr><td><div data-filter="ATTACK" class="box-border-dark icon commandTypes attack" tooltip="<#= locale("attackView", "filters.tooltip.show-attacks") #>"><span class="icon-34x34-attack icon-bg-black"></span></div><div data-filter="SUPPORT" class="box-border-dark icon commandTypes support" tooltip="<#= locale("attackView", "filters.tooltip.show-supports") #>"><span class="icon-34x34-support icon-bg-black"></span></div><div data-filter="RELOCATE" class="box-border-dark icon commandTypes relocate" tooltip="<#= locale("attackView", "filters.tooltip.show-relocations") #>"><span class="icon-34x34-relocate icon-bg-black"></span></div></td></tr></tbody></table><table class="tbl-border-light"><tbody><tr><th><#= locale("attackView", "filters.incoming-units") #></th></tr><tr><td> <# UNIT_SPEED_ORDER.forEach(function(unit) { #> <div data-filter="<#= unit #>" class="box-border-dark icon incomingUnits <#= unit #>" tooltip="<#= locale("common", unit) #>"><span class="icon-34x34-unit-<#= unit #> icon-bg-black"></span></div> <# }) #> </td></tr></tbody></table></div><table class="tbl-border-light commands-table"><colgroup><col width="7%"><col width="14%"><col width=""><col width=""><col width="4%"><col width="12%"><col width="11%"></colgroup><thead class="sorting"><tr><th data-sort="COMMAND_TYPE" tooltip="<#= locale("attackView", "tooltip.command-type") #>"><#= locale("attackView", "command-type") #></th><th data-sort="ORIGIN_CHARACTER"><#= locale("common", "player") #></th><th data-sort="ORIGIN_VILLAGE"><#= locale("common", "origin") #></th><th data-sort="TARGET_VILLAGE"><#= locale("common", "target") #></th><th tooltip="<#= locale("attackView", "tooltip.slowest-unit") #>"><#= locale("attackView", "slowest-unit") #></th><th data-sort="TIME_COMPLETED">Arrive</th><th><#= locale("attackView", "actions") #></th></tr></thead><tbody class="commands"></tbody><tbody class="empty"><tr><td colspan="7"><#= locale("attackView", "no-incoming") #></td></tr></tbody></table></div></div></div>',
            activeTab: 'attacks',
            replaces: {
                version: attackView.version,
                locale: Locale,
                UNIT_SPEED_ORDER: attackView.UNIT_SPEED_ORDER
            },
            css: '#AttackView table.commands-table{table-layout:fixed;font-size:13px}#AttackView table.commands-table th{text-align:center;padding:0px}#AttackView table.commands-table td{padding:1px 0;min-height:initial;border:none;text-align:center}#AttackView table.commands-table tr.attack.snob td{background:#bb8658}#AttackView table.commands-table tr.support td,#AttackView table.commands-table tr.relocate td{background:#9c9368}#AttackView table.commands-table .empty td{height:32px}#AttackView .village .coords{font-size:11px;color:#71471a}#AttackView .village .coords:hover{color:#ffde00;text-shadow:0 1px 0 #000}#AttackView .village .name:hover{color:#fff;text-shadow:0 1px 0 #000}#AttackView .village.selected .name{font-weight:bold}#AttackView .character .name:hover{color:#fff;text-shadow:1px 1px 0 #000}#AttackView .progress-wrapper{height:20px;margin-bottom:0}#AttackView .progress-wrapper .progress-text{position:absolute;width:100%;height:100%;text-align:center;z-index:10;padding:0 5px;line-height:20px;color:#f0ffc9;overflow:hidden}#AttackView .filters{height:95px;margin-bottom:10px}#AttackView .filters table{width:auto;float:left;margin:5px}#AttackView .filters .icon{width:38px;float:left;margin:0 6px}#AttackView .filters .icon.active:before{box-shadow:0 0 0 1px #000,-1px -1px 0 2px #ac9c44,0 0 0 3px #ac9c44,0 0 0 4px #000;border-radius:1px;content:"";position:absolute;width:38px;height:38px;left:-1px;top:-1px}#AttackView .filters td{padding:6px}#AttackView .icon-20x20-backtime{background-image:url("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABQAAAAUCAYAAACNiR0NAAAABmJLR0QA/wD/AP+gvaeTAAAEMklEQVQ4y42US2xUdRTGf3funZn/PHqnnVdpKZZ2RCWBVESgoZogSAKKEEAlGhVNLMGg0QiJKxYudIdoTEyDj8SFGo2seDUGhEQqRHk/UimDpdAptHMr8+jM3Dv35QJbi9KEszzJ+eU753z5JKYuOQGBUpAa2SLiuPgBPBKGrZAPlSlmoQLYk4ekqUCmEHHL0pslRb7fsNwWF8L/DIz5Fanftey0oogBr65rk8HS3WC6jyY8ckfZdNtfWdX++tzGIDMabAJmArte4my/l/c//vaLoFc6jmP3iCqD41B5Mi0BId1Hk+V6ljfEQlvWL2xZoY/lKOTLGCY01tZhVLMkRJEtqzoeyUvSnN70SNZRXC1iUylDVZmszhQiDmbH9Lrgpta4mKPlCjy95D6Wrn8GAKFEEfEmdG2Qowd+4I0XFrUC7+w7eL5sCu8hdL3imaQuYFl6c9l021vjYk7Y72Xjq4/z1IaNCCVKMRckq+moiQDJ2bN48uV3GbnSx9b1ra1l0223LL05AYF/Vw4S80jyonnN6paq5YTe3LyU2rpaYrFpJGfPItlcTzI1H8R8cC38NTFiaojhSzeJJ8KNJ/4YOmP43GsTCmWLiGG5LTUBb2LuzGm3e3Ij3321m5Hey6A0AVAcPjmhQcSbuDyU5sF6e5phuS2yRWQC6Lj4x62h1vjJ3BwjlUoiYn52ffolmUtnuXj4ADu2b7/DFoN9RVQ1gAthx8U/+Sk4LiGAQtFAHzXIajpr16yiu/tX98euzyWAzrc6Abj8+1G0TIZ8uYx/xJpgjANlWfEKqjaZbIlixQQgdDHDyuULWLFisZTVdBJxQTIVA2uQ+qZ6KoU0nhqV09f+QoIxj4ThAWRVJWLZToNXUaarYR8Hdm+iZBic7N5LbmgI0xclERcAFLIVAHRtkFOHjwBwNHNryK9I/bZCXlFVIk6ZuSbukidmR1Z+/cliAHzRBjKjBTq37bz9gEAAgA+2vQjAjb4j9F6pUCga/Hzm5v6A5KRDFkXF1UnWRcRj256d/vam9zrJXT0GwGc7V+ONRwAwtTwAa9bs4ND+PTy8MMW5az7+vJ7lXKZ4IeiVjsuIgaylVxTHxf/S84+u3bh5Mbmrx/D6Y1hjGtaYBjduH9g0RonNSmH4o/T1j9JzeoBixSRbsi9ktNIuRXJ6vFVbA2ypVoiZNuay+qj62r6u1R0ee4i65Iw7rDEOnLegC4CSqwxf18b23C0cFMenF5wKJzLZfLDtuW/4pWt1Ry6XY8/ug8jRB6gN3GI0k6VtXcq9csvqtm2rTyjS+YDkpGXEgLdq/z++EhA2hYjbmMtMx7P8+4/Wbdj64U89/cP5Xlli2HGcUsAnjziulMGxbrheRu4lYH21QjSarvXQoraZbQC/nUoflzwMyx6hVz26MRVkysROQNhQ8XmqQr1XwH/rb2Du69Eebp25AAAAAElFTkSuQmCC")}#AttackView .icon-20x20-arrivetime{background-image:url("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABQAAAAUCAYAAACNiR0NAAAABmJLR0QA/wD/AP+gvaeTAAAEW0lEQVQ4y4WUWWxUZRiGn7PMnNPOVtvODHQBSlulAUFBoQiEaBHBhCsSFaIhIe6JSyAkRkO8NpErY2KoYuINISkkRFAjEUyAUCQsBSu1BVpKZ2DmTNuZzsyZMz3L70Vbgkjqe/Ul//89//K9eSX+KyUKFcVKQopDxBNoALJE2VXJBUzyBpQA9xG9SA+DbF2vdRxrvqQqLWVHNAkITm8saKo0KBz3hqrqt32WlXkUWHoQZvlpQFbWmLZo//zj7W8ua7JRUoKSz+DOXYVrSZMfjnV/W+mTuvHcs/okIw9DFYAoBCw/DY6QX9yycemer9/p6KiQE7ilIj4vwNXBFIO3M1iFLKta4suNvLUwZzpZTxWZiEvJhMkHgYpf1+cKSazfsnHpnve2rVqYTg2xdvMrPL76JWKNNSxesYB1LyyDiQQ9fWkCmhxzkRuLZTcpVC1lOU4eEDNPDUzitJVc6eUDn6zuSAwl2PDGLqrnx9ECPob6kkxaPiLBEK1LniIaFVz/c4SAJsf6U2ZaEfZwxMOYuaVCJTWypKz68LXV7y6sigWf7thMdfMKkMOgryA2r5pYYwWBaA3FzBhFM8uiRXFOnumn/jGt0SjYl8t+MWzbFABkxSFSdkTTE3F3zkDyBnptw/2J5VMXpwq1gfT1AQ4eOIyi1AHw5II5hCp80bIjmhSHyEyP7Ak0AcFwuIKR/vy/PLVv7156T/1M4u8e9n/1HXqNRnNzjMS9AuGQBlMfF5zxKoA6U2hph5xp0nv+ErX1KVqfXctbH+yk65tOAOa1tolNm56TjIyFNVpmIl8GwBMEHnSzKkuUJUHh8vAYcihMIFQi3hAHZ4T65hq27dyKkbGI1uqS7a/mXO8F+gZGuDZ0j4nClFsU1adj2wrgyq5KTlOlwTOJ8STApVO/Y2VGAJgwSgBEa3VsfzXZZJKLvxyjWC7z8+G3CQf9+FS13nG9ueEwEUBRqmywEfrAvWLF4rqq5fmiwCvcIjuqYCTu8v5nnXQd7+bgoZ/48dduXF8F4ZpaNj0/j60bgly+YLTeNMyUYosxPUhONaBUpeq3K7G7T/Ym2pfWh5ZU1MzBX/0XV/64iVYe4+jR3QD4aqeGaWdylPNjABw9upv9X3R+9GVXwsjmrZQCiJDjOI4scjnTyZZc0ZhKJmM9PcNYlsu4CLJjez3jt65ij45jpZPYhVG8SRNFrcQc7eeZ9evIl9xI96Xh4yqAAaXoJCOW3zuRGjfNwbRob6wNbkkYxTizaDx9B0+pY93rnWdTYxPf+xQ9p0yvCRPciEtJqFpKEfZwyXaupArOYLbM+JK2lS3HDhyRbgwanO6eoPvEaWLxOixLY+WOrrP5onUI4Z2TdMeQZgtYySaGrM6VJVFfmnRjsiwHXEG8KR5p2/fpxjWv7jpyyCd7JxR8v03nY0Fidt2H+z1dcz1LFx7xlctb2gHO9wz1+CS1L2tZSabD4f+Asx7g+a0JbYJJg6lgAPgHUh4QWRIJr4EAAAAASUVORK5CYII=")}',
            onClose: function () {
                attackView.unregisterListeners()
            }
        })

        opener = new FrontButton('AttackView', {
            onClick: function () {
                attackView.registerListeners()
                attackView.loadCommands()
                checkCommands()
                ui.openWindow()
            },
            classHover: false,
            classBlur: false
        })

        $window = $(ui.$window)
        $commands = $window.find('.commands')
        $empty = $window.find('.empty')
        $filtersBase = $window.find('.filters')
        $filters = {
            village: $filtersBase.find('.village'),
            commandTypes: {
                ATTACK: $filtersBase.find('.attack'),
                SUPPORT: $filtersBase.find('.support'),
                RELOCATE: $filtersBase.find('.relocate')
            },
            incomingUnits: {
                light_cavalry: $filtersBase.find('.light_cavalry'),
                heavy_cavalry: $filtersBase.find('.heavy_cavalry'),
                axe: $filtersBase.find('.axe'),
                sword: $filtersBase.find('.sword'),
                ram: $filtersBase.find('.ram'),
                snob: $filtersBase.find('.snob'),
                trebuchet: $filtersBase.find('.trebuchet'),
            }
        }
        $sortings = $window.find('.sorting th[data-sort]')

        $filters.village.on('click', function () {
            attackView.toggleFilter(attackView.FILTER_TYPES.VILLAGE)
        })

        $filtersBase.find('.commandTypes').on('click', function () {
            attackView.toggleFilter(attackView.FILTER_TYPES.COMMAND_TYPES, this.dataset.filter)
        })

        $filtersBase.find('.incomingUnits').on('click', function () {
            attackView.toggleFilter(attackView.FILTER_TYPES.INCOMING_UNITS, this.dataset.filter)
        })

        $sortings.on('click', function () {
            attackView.toggleSorting(this.dataset.sort)
        })

        setInterval(function () {
            if (ui.isVisible('attacks')) {
                checkCommands()
            }
        }, 1000)

        eventQueue.bind('attackView/commandsLoaded', populateCommandsView)
        eventQueue.bind('attackView/commandCancelled', onCommandCancelled)
        eventQueue.bind('attackView/commandIgnored', onCommandIgnored)
        eventQueue.bind('attackView/villageRenamed', onVillageRenamed)
        eventQueue.bind('attackView/filtersChanged', updateFilterElements)
        eventQueue.bind('attackView/sortingChanged', updateSortingElements)
        rootScope.$on(eventTypeProvider.MAP_SELECTED_VILLAGE, onVillageSwitched)

        updateFilterElements()

        return ui
    }

    /**
     * If the a command finishes in a certain way , there is no event, so we have to trigger the reload ourselfs.
     * (e.g.: the troops die at the village of the enemy)
     */
    var checkCommands = function () {
        var commands = attackView.getCommands()
        var nowInSeconds = Date.now() * 1E-3
        var progress
        
        for (var i = 0; i < commands.length; i++) {
            progress = commands[i].model.percent()

            if (progress === 100) {
                commands[i].$command.remove()
                continue
            }

            commands[i].$arrivalProgress.style.width = progress + '%'
            commands[i].$arrivalIn.innerHTML = $timeHelper.readableSeconds($timeHelper.server2ClientTimeInSeconds(commands[i].time_completed - nowInSeconds))
        }
    }

    var populateCommandsView = function (commands) {
        $commands.children().remove()
        var now = Date.now()

        if (commands.length) {
            $empty.hide()
        } else {
            return $empty.css('display', '')
        }

        commands.forEach(function (command) {
            var $command = document.createElement('tr')

            var arriveTime = command.time_completed * 1000
            var arriveTimeFormated = utils.formatDate(arriveTime, 'HH:mm:ss dd/MM/yyyy')
            var arrivalIn = $timeHelper.server2ClientTimeInSeconds(arriveTime - now)
            var arrivalInFormated = $timeHelper.readableMilliseconds(arrivalIn, false, true)
            var duration = command.time_completed - command.time_start
            var backTime = (command.time_completed + duration) * 1000
            var backTimeFormated = utils.formatDate(backTime, 'HH:mm:ss dd/MM/yyyy')
            var commandClass = 'command-' + command.command_id + ' ' + command.command_type

            if (command.slowestUnit === UNIT_TYPES.SNOB) {
                commandClass += ' snob'
            }
            
            $command.className = commandClass
            $command.innerHTML = ejs.render('<td class="commandType"><span class="icon-20x20-<#= commandType #>"></span></td><td class="originCharacter character player-<#= originCharacter.id #>"><span class="name"><#= originCharacter.name #> </span></td><td class="originVillage village village-<#= originVillage.id #>"><span class="name"><#= originVillage.name #></span><span class="coords"> <#= originVillage.x #>|<#= originVillage.y #></span></td><td class="targetVillage village village-<#= targetVillage.id #>"><span class="name"><#= targetVillage.name #></span><span class="coords"> <#= targetVillage.x #>|<#= targetVillage.y #></span></td><td><span class="icon-20x20-unit-<#= slowestUnit #>"></span></td><td><div class="progress-wrapper" tooltip="<#= arrivalDate #>"><div class="progress-bar arrivalProgress" style="width:<#= progress #>%"></div><div class="progress-text"><span class="arrivalIn"><#= arrivalIn #></span></div></div></td><td class="actions"><a class="copyArriveTime btn btn-orange size-20x20 icon-20x20-arrivetime" tooltip="<#= locale("attackView", "commands.tooltip.copy-arrival") #>"></a> <a class="copyBackTime btn btn-red size-20x20 icon-20x20-backtime" tooltip="<#= locale("attackView", "commands.tooltip.copy-back") #>"></a> <a class="removeTroops btn btn-orange size-20x20 icon-20x20-units-outgoing" tooltip="<#= locale("attackView", "commands.tooltip.set-remove") #>"></a></td>', {
                locale: Locale,
                originCharacter: command.originCharacter,
                originVillage: command.originVillage,
                targetVillage: command.targetVillage,
                arrivalDate: arriveTimeFormated,
                arrivalIn: arrivalInFormated,
                slowestUnit: command.slowestUnit,
                progress: command.model.percent(),
                commandType: command.command_type
            })

            var $characterName = $command.querySelector('.originCharacter .name')
            var $originName = $command.querySelector('.originVillage .name')
            var $originCoords = $command.querySelector('.originVillage .coords')
            var $targetName = $command.querySelector('.targetVillage .name')
            var $targetCoords = $command.querySelector('.targetVillage .coords')
            var $arrivalProgress = $command.querySelector('.arrivalProgress')
            var $arrivalIn = $command.querySelector('.arrivalIn')
            var $removeTroops = $command.querySelector('.removeTroops')
            var $copyArriveTime = $command.querySelector('.copyArriveTime')
            var $copyBackTime = $command.querySelector('.copyBackTime')

            $characterName.addEventListener('click', function () {
                windowDisplayService.openCharacterProfile(command.originCharacter.id)
            })

            $originName.addEventListener('click', function () {
                windowDisplayService.openVillageInfo(command.originVillage.id)
            })

            $originCoords.addEventListener('click', function () {
                mapService.jumpToVillage(command.originVillage.x, command.originVillage.y)
            })

            $targetName.addEventListener('click', function () {
                windowDisplayService.openVillageInfo(command.targetVillage.id)
            })

            $targetCoords.addEventListener('click', function () {
                mapService.jumpToVillage(command.targetVillage.x, command.targetVillage.y)
            })

            $removeTroops.addEventListener('click', function () {
                var outDate = utils.formatDate((command.time_completed - 10) * 1000, 'HH:mm:ss:sss dd/MM/yyyy')
                attackView.setQueueCommand(command, outDate)
            })

            $copyArriveTime.addEventListener('click', function () {
                document.execCommand('copy')
            })

            $copyArriveTime.addEventListener('copy', function (event) {
                event.preventDefault()
                event.clipboardData.setData('text/plain', arriveTimeFormated)
                utils.emitNotif('success', 'Arrive time copied!')
            })

            $copyBackTime.addEventListener('click', function () {
                document.execCommand('copy')
            })

            $copyBackTime.addEventListener('copy', function (event) {
                event.preventDefault()
                event.clipboardData.setData('text/plain', backTimeFormated)
                utils.emitNotif('success', 'Back time copied!')
            })

            $commands.append($command)

            command.$command = $command
            command.$arrivalProgress = $arrivalProgress
            command.$arrivalIn = $arrivalIn
        })

        ui.setTooltips()
        ui.recalcScrollbar()
        highlightSelectedVillage()
    }

    var onCommandCancelled = function (commandId) {
        $commands.find('.command-' + commandId).remove()
        ui.recalcScrollbar()
    }

    var onCommandIgnored = function (commandId) {
        $commands.find('.command-' + commandId).remove()
        ui.recalcScrollbar()
    }

    var onVillageRenamed = function (village) {
        var _class = '.village-' + village.village_id + ' .name'

        $commands.find(_class).html(village.name)
    }

    var onVillageSwitched = function (e, vid) {
        var filters = attackView.getFilters()

        if (!filters[attackView.FILTER_TYPES.VILLAGE]) {
            highlightSelectedVillage(vid)
        }
    }

    var removeHighlightVillage = function () {
        $commands.find('.village.selected').removeClass('selected')
    }

    var highlightSelectedVillage = function (vid) {
        removeHighlightVillage()

        vid = vid || modelDataService.getSelectedVillage().getId()
        $commands.find('.village-' + vid).addClass('selected')
    }

    var updateFilterElements = function () {
        var filters = attackView.getFilters()
        var type
        var sub
        var fn

        for (type in filters) {
            if (angular.isObject(filters[type])) {
                for (sub in filters[type]) {
                    fn = filters[type][sub] ? 'addClass': 'removeClass'
                    $filters[type][sub][fn]('active')
                }
            } else {
                fn = filters[type] ? 'addClass': 'removeClass'
                $filters[type][fn]('active')
            }
        }
    }

    var updateSortingElements = function () {
        var sorting = attackView.getSortings()
        var $arrow = document.createElement('span')
        $arrow.className = 'float-right arrow '
        $arrow.className += sorting.reverse ? 'icon-26x26-normal-arrow-up' : 'icon-26x26-normal-arrow-down'
        
        $sortings.find('.arrow').remove()
        
        $sortings.some(function ($elem, i) {
            var sort = $elem.dataset.sort

            if (sorting.column === attackView.COLUMN_TYPES[sort]) {
                $elem.appendChild($arrow)
                return true
            }
        })
    }

    attackView.interface = function () {
        attackView.interface = init()
    }
})

define('two/autoCollector', [
    'two/eventQueue',
    'helper/time',
    'Lockr'
], function (
    eventQueue,
    $timeHelper,
    Lockr
) {
    /**
     * Indica se o modulo já foi iniciado.
     *
     * @type {Boolean}
     */
    var initialized = false

    /**
     * Indica se o modulo está em funcionamento.
     *
     * @type {Boolean}
     */
    var running = false

    /**
     * Permite que o evento RESOURCE_DEPOSIT_JOB_COLLECTIBLE seja executado
     * apenas uma vez.
     *
     * @type {Boolean}
     */
    var recall = true

    /**
     * Next automatic reroll setTimeout ID.
     * 
     * @type {Number}
     */
    var nextUpdateId = 0

    /**
     * Inicia um trabalho.
     *
     * @param {Object} job - Dados do trabalho
     */
    var startJob = function (job) {
        socketService.emit(routeProvider.RESOURCE_DEPOSIT_START_JOB, {
            job_id: job.id
        })
    }

    /**
     * Coleta um trabalho.
     *
     * @param {Object} job - Dados do trabalho
     */
    var finalizeJob = function (job) {
        socketService.emit(routeProvider.RESOURCE_DEPOSIT_COLLECT, {
            job_id: job.id,
            village_id: modelDataService.getSelectedVillage().getId()
        })
    }

    /**
     * Força a atualização das informações do depósito.
     */
    var updateDepositInfo = function () {
        socketService.emit(routeProvider.RESOURCE_DEPOSIT_GET_INFO, {})
    }

    /**
     * Faz a analise dos trabalhos sempre que um evento relacionado ao depósito
     * é disparado.
     */
    var analyse = function () {
        if (!running) {
            return false
        }

        var data = modelDataService.getSelectedCharacter().getResourceDeposit()

        if (!data) {
            return false
        }

        var current = data.getCurrentJob()

        if (current) {
            return false
        }

        var collectible = data.getCollectibleJobs()

        if (collectible) {
            return finalizeJob(collectible.shift())
        }

        var ready = data.getReadyJobs()

        if (ready) {
            return startJob(getFastestJob(ready))
        }
    }

    /**
     * Obtem o trabalho de menor duração.
     *
     * @param {Array} jobs - Lista de trabalhos prontos para serem iniciados.
     */
    var getFastestJob = function (jobs) {
        var sorted = jobs.sort(function (a, b) {
            return a.duration - b.duration
        })

        return sorted[0]
    }

    /**
     * Atualiza o timeout para que seja forçado a atualização das informações
     * do depósito quando for resetado.
     * Motivo: só é chamado automaticamente quando um milestone é resetado,
     * e não o diário.
     * 
     * @param {Object} data - Os dados recebidos de RESOURCE_DEPOSIT_INFO
     */
    var rerollUpdater = function (data) {
        var timeLeft = data.time_next_reset * 1000 - Date.now() + 1000

        clearTimeout(nextUpdateId)
        nextUpdateId = setTimeout(updateDepositInfo, timeLeft)
    }

    /**
     * Métodos públicos do AutoCollector.
     *
     * @type {Object}
     */
    var autoCollector = {}

    /**
     * Inicializa o AutoDepois, configura os eventos.
     */
    autoCollector.init = function () {
        initialized = true

        $rootScope.$on(eventTypeProvider.RESOURCE_DEPOSIT_JOB_COLLECTIBLE, function () {
            if (!recall || !running) {
                return false
            }

            recall = false

            setTimeout(function () {
                recall = true
                analyse()
            }, 1500)
        })

        $rootScope.$on(eventTypeProvider.RESOURCE_DEPOSIT_JOBS_REROLLED, analyse)
        $rootScope.$on(eventTypeProvider.RESOURCE_DEPOSIT_JOB_COLLECTED, analyse)
        $rootScope.$on(eventTypeProvider.RESOURCE_DEPOSIT_INFO, function (event, data) {
            analyse()
            rerollUpdater(data)
        })
    }

    /**
     * Inicia a analise dos trabalhos.
     */
    autoCollector.start = function () {
        eventQueue.trigger('Collector/started')
        running = true
        analyse()
    }

    /**
     * Para a analise dos trabalhos.
     */
    autoCollector.stop = function () {
        eventQueue.trigger('Collector/stopped')
        running = false
    }

    /**
     * Retorna se o modulo está em funcionamento.
     */
    autoCollector.isRunning = function () {
        return running
    }

    /**
     * Retorna se o modulo está inicializado.
     */
    autoCollector.isInitialized = function () {
        return initialized
    }

    return autoCollector
})

define('two/autoCollector/secondVillage', [
    'two/autoCollector',
    'two/eventQueue',
    'helper/time',
    'models/SecondVillageModel'
], function (
    autoCollector,
    eventQueue,
    $timeHelper,
    SecondVillageModel
) {
    var initialized = false
    var running = false
    var secondVillageService = injector.get('secondVillageService')

    var getRunningJob = function (jobs) {
        var now = Date.now()

        for (var id in jobs) {
            if (jobs[id].time_started && jobs[id].time_completed) {
                if (now < $timeHelper.server2ClientTime(jobs[id].time_completed)) {
                    return jobs[id]
                }
            }
        }

        return false
    }

    var getCollectibleJob = function (jobs) {
        var now = Date.now()

        for (var id in jobs) {
            if (jobs[id].time_started && jobs[id].time_completed) {
                if ((now >= $timeHelper.server2ClientTime(jobs[id].time_completed)) && !jobs[id].collected) {
                    return id
                }
            }
        }

        return false
    }

    var finalizeJob = function (jobId) {
        socketService.emit(routeProvider.SECOND_VILLAGE_COLLECT_JOB_REWARD, {
            village_id: modelDataService.getSelectedVillage().getId(),
            job_id: jobId
        })
    }

    var startJob = function (jobId, callback) {
        socketService.emit(routeProvider.SECOND_VILLAGE_START_JOB, {
            village_id: modelDataService.getSelectedVillage().getId(),
            job_id: jobId
        }, callback)
    }

    var getFirstJob = function (jobs) {
        for (var id in jobs) {
            return id
        }

        return false
    }

    var updateSecondVillageInfo = function (callback) {
        socketService.emit(routeProvider.SECOND_VILLAGE_GET_INFO, {}, function (data) {
            var model = new SecondVillageModel(data)
            modelDataService.getSelectedCharacter().setSecondVillage(model)
            callback()
        })
    }

    var updateAndAnalyse = function () {
        updateSecondVillageInfo(analyse)
    }

    var analyse = function () {
        var secondVillage = modelDataService.getSelectedCharacter().getSecondVillage()

        if (!running || !secondVillage || !secondVillage.isAvailable()) {
            return false
        }

        var current = getRunningJob(secondVillage.data.jobs)

        if (current) {
            var completed = $timeHelper.server2ClientTime(current.time_completed)
            var nextRun = completed - Date.now() + 1000
            setTimeout(updateAndAnalyse, nextRun)
            return false
        }

        var collectible = getCollectibleJob(secondVillage.data.jobs)
        
        if (collectible) {
            return finalizeJob(collectible)
        }

        var currentDayJobs = secondVillageService.getCurrentDayJobs(secondVillage.data.jobs, secondVillage.data.day)
        var collectedJobs = secondVillageService.getCollectedJobs(secondVillage.data.jobs)
        var resources = modelDataService.getSelectedVillage().getResources().getResources()
        var availableJobs = secondVillageService.getAvailableJobs(currentDayJobs, collectedJobs, resources, [])

        if (availableJobs) {
            var firstJob = getFirstJob(availableJobs)

            startJob(firstJob, function () {
                var job = availableJobs[firstJob]
                setTimeout(updateAndAnalyse, (job.duration * 1000) + 1000)
            })
        }
    }

    var secondVillageCollector = {}

    secondVillageCollector.init = function () {
        if (!secondVillageService.isFeatureActive()) {
            return false
        }

        initialized = true

        $rootScope.$on(eventTypeProvider.SECOND_VILLAGE_VILLAGE_CREATED, updateAndAnalyse)
        $rootScope.$on(eventTypeProvider.SECOND_VILLAGE_JOB_COLLECTED, updateAndAnalyse)
        $rootScope.$on(eventTypeProvider.SECOND_VILLAGE_VILLAGE_CREATED, updateAndAnalyse)
    }

    secondVillageCollector.start = function () {
        if (!initialized) {
            return false
        }

        eventQueue.trigger('Collector/secondVillage/started')
        running = true
        updateAndAnalyse()
    }

    secondVillageCollector.stop = function () {
        if (!initialized) {
            return false
        }

        eventQueue.trigger('Collector/secondVillage/stopped')
        running = false
    }

    secondVillageCollector.isRunning = function () {
        return running
    }

    secondVillageCollector.isInitialized = function () {
        return initialized
    }

    autoCollector.secondVillage = secondVillageCollector
})

require([
    'two/ready',
    'two/autoCollector',
    'Lockr',
    'helper/i18n',
    'two/eventQueue',
    'two/autoCollector/secondVillage',
    'two/autoCollector/ui'
], function (
    ready,
    autoCollector,
    Lockr,
    i18n,
    eventQueue
) {
    if (autoCollector.isInitialized()) {
        return false
    }

    var updateModuleLang = function () {
        var langs = {"en_us":{"collector":{"title":"AutoCollector","description":"Automatic Resource Deposit/Second Village collector.","activated":"Automatic Collector activated","deactivated":"Automatic Collector deactivated"}},"pl_pl":{"collector":{"title":"Kolekcjoner","description":"Automatyczny kolekcjoner depozytu/drugiej wioski.","activated":"Kolekcjoner aktywowany","deactivated":"Kolekcjoner deaktywowany"}},"pt_br":{"collector":{"title":"AutoCollector","description":"Coletor automático para Depósito de Recursos/Segunda Aldeia.","activated":"Coletor Automático ativado","deactivated":"Coletor Automático desativado"}}}
        var current = $rootScope.loc.ale
        var data = current in langs
            ? langs[current]
            : langs['en_us']

        i18n.setJSON(data)
    }

    ready(function () {
        updateModuleLang()
        autoCollector.init()
        autoCollector.secondVillage.init()
        autoCollector.interface()
        
        ready(function () {
            if (Lockr.get('collector-active', false, true)) {
                autoCollector.start()
                autoCollector.secondVillage.start()
            }

            eventQueue.bind('Collector/started', function () {
                Lockr.set('collector-active', true)
            })

            eventQueue.bind('Collector/stopped', function () {
                Lockr.set('collector-active', false)
            })
        }, ['initial_village'])
    })
})

define('two/autoCollector/ui', [
    'two/autoCollector',
    'two/FrontButton',
    'two/utils',
    'two/eventQueue'
], function (
    autoCollector,
    FrontButton,
    utils,
    eventQueue
) {
    var opener

    function CollectorInterface () {
        opener = new FrontButton('Collector', {
            classHover: false,
            classBlur: false,
            tooltip: $filter('i18n')('description', $rootScope.loc.ale, 'collector')
        })

        opener.click(function () {
            if (autoCollector.isRunning()) {
                autoCollector.stop()
                autoCollector.secondVillage.stop()
                utils.emitNotif('success', $filter('i18n')('deactivated', $rootScope.loc.ale, 'collector'))
            } else {
                autoCollector.start()
                autoCollector.secondVillage.start()
                utils.emitNotif('success', $filter('i18n')('activated', $rootScope.loc.ale, 'collector'))
            }
        })

        eventQueue.bind('Collector/started', function () {
            opener.$elem.classList.remove('btn-green')
            opener.$elem.classList.add('btn-red')
        })

        eventQueue.bind('Collector/stopped', function () {
            opener.$elem.classList.remove('btn-red')
            opener.$elem.classList.add('btn-green')
        })

        if (autoCollector.isRunning()) {
            eventQueue.trigger('Collector/started')
        }

        return opener
    }

    autoCollector.interface = function () {
        autoCollector.interface = CollectorInterface()
    }
})

define('two/builder', [
    'two/builder/settings',
    'two/builder/settingsMap',
    'two/builder/errorCodes',
    'two/utils',
    'queues/EventQueue',
    'two/ready',
    'Lockr',
    'conf/upgradeabilityStates',
    'conf/buildingTypes',
    'conf/locationTypes',
    'two/builder/events'
], function (
    SETTINGS,
    SETTINGS_MAP,
    ERROR_CODES,
    utils,
    eventQueue,
    ready,
    Lockr,
    UPGRADEABILITY_STATES,
    BUILDING_TYPES,
    LOCATION_TYPES
) {
    var buildingService = injector.get('buildingService')
    var initialized = false
    var running = false
    var localSettings
    var intervalCheckId
    var buildingSequenceLimit
    var ANALYSES_PER_MINUTE = 1
    var VILLAGE_BUILDINGS = {}
    var groupList
    var $player
    var logs
    var settings = {}
    var STORAGE_ID = {
        LOGS: 'builder_queue_log',
        SETTINGS: 'builder_queue_settings'
    }

    /**
     * Loop all player villages, check if ready and init the building analyse
     * for each village.
     */
    var analyseVillages = function () {
        var villageIds = settings[SETTINGS.GROUP_VILLAGES]
            ? groupList.getGroupVillageIds(settings[SETTINGS.GROUP_VILLAGES])
            : getVillageIds()
        var village
        var readyState
        var queue

        villageIds.forEach(function (id) {
            village = $player.getVillage(id)
            readyState = village.checkReadyState()
            queue = village.buildingQueue

            if (queue.getAmountJobs() === queue.getUnlockedSlots()) {
                return false
            }

            if (!readyState.buildingQueue || !readyState.buildings) {
                return false
            }

            if (!village.isInitialized()) {
                villageService.initializeVillage(village)
            }

            analyseVillageBuildings(village)
        })
    }

    /**
     * Generate an Array with all player's village IDs.
     *
     * @return {Array}
     */
    var getVillageIds = function () {
        var ids = []
        var villages = $player.getVillages()
        var id

        for (id in villages) {
            ids.push(id)
        }

        return ids
    }

    /**
     * Loop all village buildings, start build job if available.
     *
     * @param {VillageModel} village
     */
    var analyseVillageBuildings = function (village) {
        var buildingLevels = angular.copy(village.buildingData.getBuildingLevels())
        var currentQueue = village.buildingQueue.getQueue()
        var sequence = angular.copy(VILLAGE_BUILDINGS)
        var now
        var logData

        currentQueue.forEach(function (job) {
            buildingLevels[job.building]++
        })

        if (checkVillageBuildingLimit(buildingLevels)) {
            return false
        }

        settings[SETTINGS.BUILDING_SEQUENCES][settings[SETTINGS.ACTIVE_SEQUENCE]].some(function (buildingName) {
            if (++sequence[buildingName] > buildingLevels[buildingName]) {
                buildingService.compute(village)

                upgradeBuilding(village, buildingName, function (jobAdded, data) {
                    if (jobAdded) {
                        now = Date.now()
                        logData = [
                            {
                                x: village.getX(),
                                y: village.getY(),
                                name: village.getName(),
                                id: village.getId()
                            },
                            data.job.building,
                            data.job.level,
                            now
                        ]

                        eventQueue.trigger(eventTypeProvider.BUILDER_QUEUE_JOB_STARTED, logData)
                        logs.unshift(logData)
                        Lockr.set(STORAGE_ID.LOGS, logs)
                    }
                })

                return true
            }
        })
    }

    /**
     * Init a build job
     *
     * @param {VillageModel} village
     * @param {String} buildingName - Building to be build.
     * @param {Function} callback
     */
    var upgradeBuilding = function (village, buildingName, callback) {
        var buildingData = village.getBuildingData().getDataForBuilding(buildingName)

        if (buildingData.upgradeability === UPGRADEABILITY_STATES.POSSIBLE) {
            socketService.emit(routeProvider.VILLAGE_UPGRADE_BUILDING, {
                building: buildingName,
                village_id: village.getId(),
                location: LOCATION_TYPES.MASS_SCREEN,
                premium: false
            }, function (data, event) {
                callback(true, data)
            })
        } else {
            callback(false)
        }
    }

    /**
     * Check if all buildings from the sequence already reached
     * the specified level.
     *
     * @param {Object} buildingLevels - Current buildings level from the village.
     * @return {Boolean} True if the levels already reached the limit.
     */
    var checkVillageBuildingLimit = function (buildingLevels) {
        for (var buildingName in buildingLevels) {
            if (buildingLevels[buildingName] < buildingSequenceLimit[buildingName]) {
                return false
            }
        }

        return true
    }

    /**
     * Check if the building sequence is valid by analysing if the
     * buildings exceed the maximum level.
     *
     * @param {Array} sequence
     * @return {Boolean}
     */
    var validSequence = function (sequence) {
        var sequence = angular.copy(VILLAGE_BUILDINGS)
        var buildingData = modelDataService.getGameData().getBuildings()
        var building
        var i

        for (i = 0; i < sequence.length; i++) {
            building = sequence[i]

            if (++sequence[building] > buildingData[building].max_level) {
                return false
            }
        }

        return true
    }

    /**
     * Get the level max for each building.
     *
     * @param {String} sequenceId
     * @return {Object} Maximum level for each building.
     */
    var getSequenceLimit = function (sequenceId) {
        var sequence = settings[SETTINGS.BUILDING_SEQUENCES][sequenceId]
        var sequenceLimit = angular.copy(VILLAGE_BUILDINGS)

        sequence.forEach(function (buildingName) {
            sequenceLimit[buildingName]++
        })

        return sequenceLimit
    }

    var builderQueue = {}

    builderQueue.init = function () {
        var key
        var defaultValue
        var buildingName
        var village

        initialized = true
        localSettings = Lockr.get(STORAGE_ID.SETTINGS, {}, true)
        logs = Lockr.get(STORAGE_ID.LOGS, [], true)
        $player = modelDataService.getSelectedCharacter()
        groupList = modelDataService.getGroupList()

        for (key in SETTINGS_MAP) {
            defaultValue = SETTINGS_MAP[key].default
            settings[key] = localSettings.hasOwnProperty(key) ? localSettings[key] : defaultValue
        }

        for (buildingName in BUILDING_TYPES) {
            VILLAGE_BUILDINGS[BUILDING_TYPES[buildingName]] = 0
        }

        buildingSequenceLimit = getSequenceLimit(settings[SETTINGS.ACTIVE_SEQUENCE])

        $rootScope.$on(eventTypeProvider.BUILDING_LEVEL_CHANGED, function (event, data) {
            if (!running) {
                return false
            }

            setTimeout(function () {
                village = $player.getVillage(data.village_id)
                analyseVillageBuildings(village)
            }, 1000)
        })
    }

    builderQueue.start = function () {
        running = true
        intervalCheckId = setInterval(analyseVillages, 60000 / ANALYSES_PER_MINUTE)
        ready(analyseVillages, ['all_villages_ready'])
        eventQueue.trigger(eventTypeProvider.BUILDER_QUEUE_START)
    }

    builderQueue.stop = function () {
        running = false
        clearInterval(intervalCheckId)
        eventQueue.trigger(eventTypeProvider.BUILDER_QUEUE_STOP)
    }

    builderQueue.isRunning = function () {
        return running
    }

    builderQueue.isInitialized = function () {
        return initialized
    }

    builderQueue.updateSettings = function (changes) {
        var newValue
        var key

        for (key in changes) {
            if (!SETTINGS_MAP[key]) {
                eventQueue.trigger(eventTypeProvider.BUILDER_QUEUE_UNKNOWN_SETTING, [key])

                return false
            }

            newValue = changes[key]

            if (angular.equals(settings[key], newValue)) {
                continue
            }

            settings[key] = newValue
        }

        buildingSequenceLimit = getSequenceLimit(changes[SETTINGS.ACTIVE_SEQUENCE])
        Lockr.set(STORAGE_ID.SETTINGS, settings)

        eventQueue.trigger(eventTypeProvider.BUILDER_QUEUE_SETTINGS_CHANGE)

        return true
    }

    builderQueue.getSettings = function () {
        return settings
    }

    builderQueue.getLogs = function () {
        return logs
    }

    builderQueue.clearLogs = function () {
        logs = []
        Lockr.set(STORAGE_ID.LOGS, logs)
        eventQueue.trigger(eventTypeProvider.BUILDER_QUEUE_CLEAR_LOGS)
    }

    builderQueue.addBuildingSequence = function (id, sequence) {
        if (id in settings[SETTINGS.BUILDING_SEQUENCES]) {
            return ERROR_CODES.SEQUENCE_EXISTS
        }

        if (!angular.isArray(sequence)) {
            return ERROR_CODES.SEQUENCE_INVALID
        }

        settings[SETTINGS.BUILDING_SEQUENCES][id] = sequence
        Lockr.set(STORAGE_ID.SETTINGS, settings)
        eventQueue.trigger(eventTypeProvider.BUILDER_QUEUE_BUILDING_SEQUENCES_ADDED, id)

        return true
    }

    builderQueue.updateBuildingSequence = function (id, sequence) {
        if (!(id in settings[SETTINGS.BUILDING_SEQUENCES])) {
            return ERROR_CODES.SEQUENCE_NO_EXISTS
        }

        if (!angular.isArray(sequence) || !validSequence(sequence)) {
            return ERROR_CODES.SEQUENCE_INVALID
        }

        settings[SETTINGS.BUILDING_SEQUENCES][id] = sequence
        Lockr.set(STORAGE_ID.SETTINGS, settings)
        eventQueue.trigger(eventTypeProvider.BUILDER_QUEUE_BUILDING_SEQUENCES_UPDATED, id)

        return true
    }

    builderQueue.removeSequence = function (id) {
        if (!(id in settings[SETTINGS.BUILDING_SEQUENCES])) {
            return ERROR_CODES.SEQUENCE_NO_EXISTS
        }

        delete settings[SETTINGS.BUILDING_SEQUENCES][id]
        Lockr.set(STORAGE_ID.SETTINGS, settings)
        eventQueue.trigger(eventTypeProvider.BUILDER_QUEUE_BUILDING_SEQUENCES_REMOVED, id)
    }

    return builderQueue
})

define('two/builder/defaultOrders', [
    'conf/buildingTypes'
], function (
    BUILDING_TYPES
) {
    var defaultOrders = {}

    defaultOrders['Essential'] = [
        BUILDING_TYPES.HEADQUARTER, // 1
        BUILDING_TYPES.FARM, // 1
        BUILDING_TYPES.WAREHOUSE, // 1
        BUILDING_TYPES.RALLY_POINT, // 1
        BUILDING_TYPES.BARRACKS, // 1

        // Quest: The Resources
        BUILDING_TYPES.TIMBER_CAMP, // 1
        BUILDING_TYPES.TIMBER_CAMP, // 2
        BUILDING_TYPES.CLAY_PIT, // 1
        BUILDING_TYPES.IRON_MINE, // 1

        BUILDING_TYPES.HEADQUARTER, // 2
        BUILDING_TYPES.RALLY_POINT, // 2

        // Quest: First Steps
        BUILDING_TYPES.FARM, // 2
        BUILDING_TYPES.WAREHOUSE, // 2
        
        // Quest: Laying Down Foundation
        BUILDING_TYPES.CLAY_PIT, // 2
        BUILDING_TYPES.IRON_MINE, // 2

        // Quest: More Resources
        BUILDING_TYPES.TIMBER_CAMP, // 3
        BUILDING_TYPES.CLAY_PIT, // 3
        BUILDING_TYPES.IRON_MINE, // 3
        
        // Quest: Resource Building
        BUILDING_TYPES.WAREHOUSE, // 3
        BUILDING_TYPES.TIMBER_CAMP, // 4
        BUILDING_TYPES.CLAY_PIT, // 4
        BUILDING_TYPES.IRON_MINE, // 4

        // Quest: Get an Overview
        BUILDING_TYPES.WAREHOUSE, // 4
        BUILDING_TYPES.TIMBER_CAMP, // 5
        BUILDING_TYPES.CLAY_PIT, // 5
        BUILDING_TYPES.IRON_MINE, // 5

        // Quest: Capital
        BUILDING_TYPES.FARM, // 3
        BUILDING_TYPES.WAREHOUSE, // 5
        BUILDING_TYPES.HEADQUARTER, // 3

        // Quest: The Hero
        BUILDING_TYPES.STATUE, // 1

        // Quest: Resource Expansions
        BUILDING_TYPES.TIMBER_CAMP, // 6
        BUILDING_TYPES.CLAY_PIT, // 6
        BUILDING_TYPES.IRON_MINE, // 6
        
        // Quest: Military
        BUILDING_TYPES.BARRACKS, // 2

        // Quest: The Hospital
        BUILDING_TYPES.HEADQUARTER, // 4
        BUILDING_TYPES.TIMBER_CAMP, // 7
        BUILDING_TYPES.CLAY_PIT, // 7
        BUILDING_TYPES.IRON_MINE, // 7
        BUILDING_TYPES.FARM, // 4
        BUILDING_TYPES.HOSPITAL, // 1

        // Quest: Resources
        BUILDING_TYPES.TIMBER_CAMP, // 8
        BUILDING_TYPES.CLAY_PIT, // 8
        BUILDING_TYPES.IRON_MINE, // 8

        // Quest: The Wall
        BUILDING_TYPES.WAREHOUSE, // 6
        BUILDING_TYPES.HEADQUARTER, // 5
        BUILDING_TYPES.WALL, // 1
        
        // Quest: Village Improvements
        BUILDING_TYPES.TIMBER_CAMP, // 9
        BUILDING_TYPES.CLAY_PIT, // 9
        BUILDING_TYPES.IRON_MINE, // 9
        BUILDING_TYPES.TIMBER_CAMP, // 10
        BUILDING_TYPES.CLAY_PIT, // 10
        BUILDING_TYPES.IRON_MINE, // 10
        BUILDING_TYPES.FARM, // 5

        BUILDING_TYPES.FARM, // 6
        BUILDING_TYPES.FARM, // 7

        // Quest: Hard work
        BUILDING_TYPES.TIMBER_CAMP, // 11
        BUILDING_TYPES.CLAY_PIT, // 11
        BUILDING_TYPES.IRON_MINE, // 11
        BUILDING_TYPES.TIMBER_CAMP, // 12
        BUILDING_TYPES.CLAY_PIT, // 12
        BUILDING_TYPES.IRON_MINE, // 12

        // Quest: The way of defence
        BUILDING_TYPES.BARRACKS, // 3

        BUILDING_TYPES.WAREHOUSE, // 7
        BUILDING_TYPES.WAREHOUSE, // 8
        BUILDING_TYPES.FARM, // 8
        BUILDING_TYPES.WAREHOUSE, // 9
        BUILDING_TYPES.WAREHOUSE, // 10

        // Quest: Market Barker
        BUILDING_TYPES.HEADQUARTER, // 6
        BUILDING_TYPES.MARKET, // 1

        // Quest: Preparations
        BUILDING_TYPES.BARRACKS, // 4
        BUILDING_TYPES.WALL, // 2
        BUILDING_TYPES.WALL, // 3

        BUILDING_TYPES.FARM, // 9
        BUILDING_TYPES.FARM, // 10

        BUILDING_TYPES.BARRACKS, // 5
        BUILDING_TYPES.WAREHOUSE, // 11
        BUILDING_TYPES.FARM, // 11

        BUILDING_TYPES.BARRACKS, // 6
        BUILDING_TYPES.WAREHOUSE, // 12
        BUILDING_TYPES.FARM, // 12

        BUILDING_TYPES.BARRACKS, // 7
        BUILDING_TYPES.WAREHOUSE, // 13
        BUILDING_TYPES.FARM, // 13

        BUILDING_TYPES.WALL, // 4
        BUILDING_TYPES.WALL, // 5
        BUILDING_TYPES.WALL, // 6

        BUILDING_TYPES.MARKET, // 2
        BUILDING_TYPES.MARKET, // 3
        BUILDING_TYPES.MARKET, // 4
        
        BUILDING_TYPES.BARRACKS, // 8
        BUILDING_TYPES.BARRACKS, // 9

        BUILDING_TYPES.HEADQUARTER, // 7
        BUILDING_TYPES.HEADQUARTER, // 8
        
        BUILDING_TYPES.TAVERN, // 1
        BUILDING_TYPES.TAVERN, // 2
        BUILDING_TYPES.TAVERN, // 3

        BUILDING_TYPES.RALLY_POINT, // 3

        BUILDING_TYPES.BARRACKS, // 10
        BUILDING_TYPES.BARRACKS, // 11

        BUILDING_TYPES.WAREHOUSE, // 14
        BUILDING_TYPES.FARM, // 14

        BUILDING_TYPES.WAREHOUSE, // 15
        BUILDING_TYPES.FARM, // 15

        BUILDING_TYPES.BARRACKS, // 12
        BUILDING_TYPES.BARRACKS, // 13

        BUILDING_TYPES.STATUE, // 2
        BUILDING_TYPES.STATUE, // 3

        BUILDING_TYPES.WALL, // 7
        BUILDING_TYPES.WALL, // 8

        BUILDING_TYPES.HEADQUARTER, // 9
        BUILDING_TYPES.HEADQUARTER, // 10

        BUILDING_TYPES.WAREHOUSE, // 16
        BUILDING_TYPES.FARM, // 16
        BUILDING_TYPES.FARM, // 17

        BUILDING_TYPES.IRON_MINE, // 13
        BUILDING_TYPES.IRON_MINE, // 14
        BUILDING_TYPES.IRON_MINE, // 15

        BUILDING_TYPES.WAREHOUSE, // 17

        BUILDING_TYPES.BARRACKS, // 14
        BUILDING_TYPES.BARRACKS, // 15

        BUILDING_TYPES.WAREHOUSE, // 18
        BUILDING_TYPES.FARM, // 18

        BUILDING_TYPES.WALL, // 9
        BUILDING_TYPES.WALL, // 10

        BUILDING_TYPES.TAVERN, // 4
        BUILDING_TYPES.TAVERN, // 5
        BUILDING_TYPES.TAVERN, // 6

        BUILDING_TYPES.MARKET, // 5
        BUILDING_TYPES.MARKET, // 6
        BUILDING_TYPES.MARKET, // 7

        BUILDING_TYPES.WAREHOUSE, // 19
        BUILDING_TYPES.FARM, // 19
        BUILDING_TYPES.WAREHOUSE, // 20
        BUILDING_TYPES.FARM, // 20
        BUILDING_TYPES.WAREHOUSE, // 21
        BUILDING_TYPES.FARM, // 21

        BUILDING_TYPES.IRON_MINE, // 16
        BUILDING_TYPES.IRON_MINE, // 17
        BUILDING_TYPES.IRON_MINE, // 18

        BUILDING_TYPES.RALLY_POINT, // 4

        BUILDING_TYPES.BARRACKS, // 16
        BUILDING_TYPES.BARRACKS, // 17

        BUILDING_TYPES.FARM, // 22
        BUILDING_TYPES.FARM, // 23
        BUILDING_TYPES.FARM, // 24
        BUILDING_TYPES.FARM, // 25

        BUILDING_TYPES.WAREHOUSE, // 22
        BUILDING_TYPES.WAREHOUSE, // 23

        BUILDING_TYPES.HEADQUARTER, // 11
        BUILDING_TYPES.HEADQUARTER, // 12

        BUILDING_TYPES.STATUE, // 4
        BUILDING_TYPES.STATUE, // 5

        BUILDING_TYPES.FARM, // 26
        BUILDING_TYPES.BARRACKS, // 18

        BUILDING_TYPES.HEADQUARTER, // 14
        BUILDING_TYPES.HEADQUARTER, // 15

        BUILDING_TYPES.FARM, // 27
        BUILDING_TYPES.BARRACKS, // 19

        BUILDING_TYPES.HEADQUARTER, // 15
        BUILDING_TYPES.HEADQUARTER, // 16

        BUILDING_TYPES.BARRACKS, // 20

        BUILDING_TYPES.HEADQUARTER, // 17
        BUILDING_TYPES.HEADQUARTER, // 18
        BUILDING_TYPES.HEADQUARTER, // 19
        BUILDING_TYPES.HEADQUARTER, // 20

        BUILDING_TYPES.ACADEMY, // 1

        BUILDING_TYPES.FARM, // 28
        BUILDING_TYPES.WAREHOUSE, // 23
        BUILDING_TYPES.WAREHOUSE, // 24
        BUILDING_TYPES.WAREHOUSE, // 25

        BUILDING_TYPES.MARKET, // 8
        BUILDING_TYPES.MARKET, // 9
        BUILDING_TYPES.MARKET, // 10

        BUILDING_TYPES.TIMBER_CAMP, // 13
        BUILDING_TYPES.CLAY_PIT, // 13
        BUILDING_TYPES.IRON_MINE, // 19

        BUILDING_TYPES.TIMBER_CAMP, // 14
        BUILDING_TYPES.CLAY_PIT, // 14
        BUILDING_TYPES.TIMBER_CAMP, // 15
        BUILDING_TYPES.CLAY_PIT, // 15

        BUILDING_TYPES.TIMBER_CAMP, // 16
        BUILDING_TYPES.TIMBER_CAMP, // 17

        BUILDING_TYPES.WALL, // 11
        BUILDING_TYPES.WALL, // 12

        BUILDING_TYPES.MARKET, // 11
        BUILDING_TYPES.MARKET, // 12
        BUILDING_TYPES.MARKET, // 13

        BUILDING_TYPES.TIMBER_CAMP, // 18
        BUILDING_TYPES.CLAY_PIT, // 16
        BUILDING_TYPES.TIMBER_CAMP, // 19
        BUILDING_TYPES.CLAY_PIT, // 17

        BUILDING_TYPES.TAVERN, // 7
        BUILDING_TYPES.TAVERN, // 8
        BUILDING_TYPES.TAVERN, // 9

        BUILDING_TYPES.WALL, // 13
        BUILDING_TYPES.WALL, // 14

        BUILDING_TYPES.TIMBER_CAMP, // 20
        BUILDING_TYPES.CLAY_PIT, // 18
        BUILDING_TYPES.IRON_MINE, // 20

        BUILDING_TYPES.TIMBER_CAMP, // 21
        BUILDING_TYPES.CLAY_PIT, // 19
        BUILDING_TYPES.IRON_MINE, // 21

        BUILDING_TYPES.BARRACKS, // 21
        BUILDING_TYPES.BARRACKS, // 22
        BUILDING_TYPES.BARRACKS, // 23

        BUILDING_TYPES.FARM, // 29
        BUILDING_TYPES.WAREHOUSE, // 26
        BUILDING_TYPES.WAREHOUSE, // 27

        BUILDING_TYPES.TAVERN, // 10
        BUILDING_TYPES.TAVERN, // 11
        BUILDING_TYPES.TAVERN, // 12

        BUILDING_TYPES.TIMBER_CAMP, // 22
        BUILDING_TYPES.CLAY_PIT, // 20
        BUILDING_TYPES.IRON_MINE, // 22

        BUILDING_TYPES.TIMBER_CAMP, // 23
        BUILDING_TYPES.CLAY_PIT, // 21
        BUILDING_TYPES.IRON_MINE, // 23

        BUILDING_TYPES.TIMBER_CAMP, // 24
        BUILDING_TYPES.CLAY_PIT, // 22
        BUILDING_TYPES.IRON_MINE, // 24

        BUILDING_TYPES.BARRACKS, // 24
        BUILDING_TYPES.BARRACKS, // 25

        BUILDING_TYPES.FARM, // 30
        BUILDING_TYPES.WAREHOUSE, // 28
        BUILDING_TYPES.WAREHOUSE, // 29

        BUILDING_TYPES.WALL, // 15
        BUILDING_TYPES.WALL, // 16
        BUILDING_TYPES.WALL, // 17
        BUILDING_TYPES.WALL, // 18

        BUILDING_TYPES.TAVERN, // 13
        BUILDING_TYPES.TAVERN, // 14

        BUILDING_TYPES.RALLY_POINT, // 5

        BUILDING_TYPES.TIMBER_CAMP, // 25
        BUILDING_TYPES.CLAY_PIT, // 23
        BUILDING_TYPES.IRON_MINE, // 25

        BUILDING_TYPES.TIMBER_CAMP, // 26
        BUILDING_TYPES.CLAY_PIT, // 24
        BUILDING_TYPES.IRON_MINE, // 26

        BUILDING_TYPES.TIMBER_CAMP, // 27
        BUILDING_TYPES.CLAY_PIT, // 25
        BUILDING_TYPES.IRON_MINE, // 27

        BUILDING_TYPES.TIMBER_CAMP, // 28
        BUILDING_TYPES.CLAY_PIT, // 26
        BUILDING_TYPES.IRON_MINE, // 28

        BUILDING_TYPES.TIMBER_CAMP, // 29
        BUILDING_TYPES.CLAY_PIT, // 27
        BUILDING_TYPES.CLAY_PIT, // 28
        BUILDING_TYPES.IRON_MINE, // 29

        BUILDING_TYPES.TIMBER_CAMP, // 30
        BUILDING_TYPES.CLAY_PIT, // 29
        BUILDING_TYPES.CLAY_PIT, // 30
        BUILDING_TYPES.IRON_MINE, // 30

        BUILDING_TYPES.WALL, // 19
        BUILDING_TYPES.WALL, // 20
    ]

    defaultOrders['Full Village'] = [
        BUILDING_TYPES.HOSPITAL, // 2
        BUILDING_TYPES.HOSPITAL, // 3
        BUILDING_TYPES.HOSPITAL, // 4
        BUILDING_TYPES.HOSPITAL, // 5

        BUILDING_TYPES.MARKET, // 14
        BUILDING_TYPES.MARKET, // 15
        BUILDING_TYPES.MARKET, // 16
        BUILDING_TYPES.MARKET, // 17

        BUILDING_TYPES.HEADQUARTER, // 21
        BUILDING_TYPES.HEADQUARTER, // 22
        BUILDING_TYPES.HEADQUARTER, // 23
        BUILDING_TYPES.HEADQUARTER, // 24
        BUILDING_TYPES.HEADQUARTER, // 25

        BUILDING_TYPES.PRECEPTORY, // 1

        BUILDING_TYPES.HOSPITAL, // 6
        BUILDING_TYPES.HOSPITAL, // 7
        BUILDING_TYPES.HOSPITAL, // 8
        BUILDING_TYPES.HOSPITAL, // 9
        BUILDING_TYPES.HOSPITAL, // 10

        BUILDING_TYPES.MARKET, // 18
        BUILDING_TYPES.MARKET, // 19
        BUILDING_TYPES.MARKET, // 20
        BUILDING_TYPES.MARKET, // 21

        BUILDING_TYPES.PRECEPTORY, // 2
        BUILDING_TYPES.PRECEPTORY, // 3

        BUILDING_TYPES.MARKET, // 22
        BUILDING_TYPES.MARKET, // 23
        BUILDING_TYPES.MARKET, // 24
        BUILDING_TYPES.MARKET, // 25

        BUILDING_TYPES.HEADQUARTER, // 26
        BUILDING_TYPES.HEADQUARTER, // 27
        BUILDING_TYPES.HEADQUARTER, // 28
        BUILDING_TYPES.HEADQUARTER, // 29
        BUILDING_TYPES.HEADQUARTER, // 30

        BUILDING_TYPES.PRECEPTORY, // 4
        BUILDING_TYPES.PRECEPTORY, // 5
        BUILDING_TYPES.PRECEPTORY, // 6
        BUILDING_TYPES.PRECEPTORY, // 7
        BUILDING_TYPES.PRECEPTORY, // 8
        BUILDING_TYPES.PRECEPTORY, // 9
        BUILDING_TYPES.PRECEPTORY, // 10
    ]

    defaultOrders['War Build'] = [
        BUILDING_TYPES.HEADQUARTER, // 1
        BUILDING_TYPES.FARM, // 1
        BUILDING_TYPES.WAREHOUSE, // 1
        BUILDING_TYPES.RALLY_POINT, // 1
        BUILDING_TYPES.BARRACKS, // 1

        // Quest: The Resources
        BUILDING_TYPES.TIMBER_CAMP, // 1
        BUILDING_TYPES.TIMBER_CAMP, // 2
        BUILDING_TYPES.CLAY_PIT, // 1
        BUILDING_TYPES.IRON_MINE, // 1

        BUILDING_TYPES.HEADQUARTER, // 2
        BUILDING_TYPES.RALLY_POINT, // 2

        // Quest: First Steps
        BUILDING_TYPES.FARM, // 2
        BUILDING_TYPES.WAREHOUSE, // 2
        
        // Quest: Laying Down Foundation
        BUILDING_TYPES.CLAY_PIT, // 2
        BUILDING_TYPES.IRON_MINE, // 2

        // Quest: More Resources
        BUILDING_TYPES.TIMBER_CAMP, // 3
        BUILDING_TYPES.CLAY_PIT, // 3
        BUILDING_TYPES.IRON_MINE, // 3
        
        // Quest: Resource Building
        BUILDING_TYPES.WAREHOUSE, // 3
        BUILDING_TYPES.TIMBER_CAMP, // 4
        BUILDING_TYPES.CLAY_PIT, // 4
        BUILDING_TYPES.IRON_MINE, // 4

        // Quest: Get an Overview
        BUILDING_TYPES.WAREHOUSE, // 4
        BUILDING_TYPES.TIMBER_CAMP, // 5
        BUILDING_TYPES.CLAY_PIT, // 5
        BUILDING_TYPES.IRON_MINE, // 5

        // Quest: Capital
        BUILDING_TYPES.FARM, // 3
        BUILDING_TYPES.WAREHOUSE, // 5
        BUILDING_TYPES.HEADQUARTER, // 3

        // Quest: The Hero
        BUILDING_TYPES.STATUE, // 1

        // Quest: Resource Expansions
        BUILDING_TYPES.TIMBER_CAMP, // 6
        BUILDING_TYPES.CLAY_PIT, // 6
        BUILDING_TYPES.IRON_MINE, // 6
        
        // Quest: Military
        BUILDING_TYPES.BARRACKS, // 2

        // Quest: The Hospital
        BUILDING_TYPES.HEADQUARTER, // 4
        BUILDING_TYPES.TIMBER_CAMP, // 7
        BUILDING_TYPES.CLAY_PIT, // 7
        BUILDING_TYPES.IRON_MINE, // 7
        BUILDING_TYPES.FARM, // 4
        BUILDING_TYPES.HOSPITAL, // 1

        // Quest: Resources
        BUILDING_TYPES.TIMBER_CAMP, // 8
        BUILDING_TYPES.CLAY_PIT, // 8
        BUILDING_TYPES.IRON_MINE, // 8

        // Quest: The Wall
        BUILDING_TYPES.WAREHOUSE, // 6
        BUILDING_TYPES.HEADQUARTER, // 5
        BUILDING_TYPES.WALL, // 1
        
        // Quest: Village Improvements
        BUILDING_TYPES.TIMBER_CAMP, // 9
        BUILDING_TYPES.CLAY_PIT, // 9
        BUILDING_TYPES.IRON_MINE, // 9
        BUILDING_TYPES.TIMBER_CAMP, // 10
        BUILDING_TYPES.CLAY_PIT, // 10
        BUILDING_TYPES.IRON_MINE, // 10
        BUILDING_TYPES.FARM, // 5

        // Quest: Hard work
        BUILDING_TYPES.TIMBER_CAMP, // 11
        BUILDING_TYPES.CLAY_PIT, // 11
        BUILDING_TYPES.IRON_MINE, // 11
        BUILDING_TYPES.TIMBER_CAMP, // 12
        BUILDING_TYPES.CLAY_PIT, // 12
        BUILDING_TYPES.IRON_MINE, // 12

        // Quest: The way of defence
        BUILDING_TYPES.BARRACKS, // 3

        BUILDING_TYPES.FARM, // 6
        BUILDING_TYPES.WAREHOUSE, // 7
        BUILDING_TYPES.FARM, // 7
        BUILDING_TYPES.WAREHOUSE, // 8
        BUILDING_TYPES.FARM, // 8
        BUILDING_TYPES.WAREHOUSE, // 9
        BUILDING_TYPES.WAREHOUSE, // 10

        // Quest: Market Barker
        BUILDING_TYPES.HEADQUARTER, // 6
        BUILDING_TYPES.MARKET, // 1

        // Quest: Preparations
        BUILDING_TYPES.BARRACKS, // 4
        BUILDING_TYPES.WALL, // 2
        BUILDING_TYPES.WALL, // 3

        BUILDING_TYPES.FARM, // 9
        BUILDING_TYPES.FARM, // 10

        BUILDING_TYPES.BARRACKS, // 5
        BUILDING_TYPES.WAREHOUSE, // 11
        BUILDING_TYPES.FARM, // 11

        BUILDING_TYPES.BARRACKS, // 6
        BUILDING_TYPES.WAREHOUSE, // 12
        BUILDING_TYPES.FARM, // 12

        BUILDING_TYPES.BARRACKS, // 7
        BUILDING_TYPES.WAREHOUSE, // 13
        BUILDING_TYPES.FARM, // 13

        BUILDING_TYPES.WALL, // 4
        BUILDING_TYPES.WALL, // 5
        BUILDING_TYPES.WALL, // 6

        BUILDING_TYPES.MARKET, // 2
        BUILDING_TYPES.MARKET, // 3
        BUILDING_TYPES.MARKET, // 4
        
        BUILDING_TYPES.BARRACKS, // 8
        BUILDING_TYPES.BARRACKS, // 9

        BUILDING_TYPES.HEADQUARTER, // 7
        BUILDING_TYPES.HEADQUARTER, // 8
        
        BUILDING_TYPES.TAVERN, // 1
        BUILDING_TYPES.TAVERN, // 2
        BUILDING_TYPES.TAVERN, // 3

        BUILDING_TYPES.RALLY_POINT, // 3

        BUILDING_TYPES.BARRACKS, // 10
        BUILDING_TYPES.BARRACKS, // 11

        BUILDING_TYPES.WAREHOUSE, // 14
        BUILDING_TYPES.FARM, // 14

        BUILDING_TYPES.WAREHOUSE, // 15
        BUILDING_TYPES.FARM, // 15

        BUILDING_TYPES.BARRACKS, // 12
        BUILDING_TYPES.BARRACKS, // 13

        BUILDING_TYPES.STATUE, // 2
        BUILDING_TYPES.STATUE, // 3

        BUILDING_TYPES.WALL, // 7
        BUILDING_TYPES.WALL, // 8

        BUILDING_TYPES.HEADQUARTER, // 9
        BUILDING_TYPES.HEADQUARTER, // 10

        BUILDING_TYPES.WAREHOUSE, // 16
        BUILDING_TYPES.FARM, // 16
        BUILDING_TYPES.FARM, // 17

        BUILDING_TYPES.IRON_MINE, // 13
        BUILDING_TYPES.IRON_MINE, // 14
        BUILDING_TYPES.IRON_MINE, // 15

        BUILDING_TYPES.WAREHOUSE, // 17

        BUILDING_TYPES.BARRACKS, // 14
        BUILDING_TYPES.BARRACKS, // 15

        BUILDING_TYPES.WAREHOUSE, // 18
        BUILDING_TYPES.FARM, // 18

        BUILDING_TYPES.WALL, // 9
        BUILDING_TYPES.WALL, // 10

        BUILDING_TYPES.TAVERN, // 4
        BUILDING_TYPES.TAVERN, // 5
        BUILDING_TYPES.TAVERN, // 6

        BUILDING_TYPES.MARKET, // 5
        BUILDING_TYPES.MARKET, // 6
        BUILDING_TYPES.MARKET, // 7

        BUILDING_TYPES.WAREHOUSE, // 19
        BUILDING_TYPES.FARM, // 19
        BUILDING_TYPES.WAREHOUSE, // 20
        BUILDING_TYPES.FARM, // 20
        BUILDING_TYPES.WAREHOUSE, // 21
        BUILDING_TYPES.FARM, // 21

        BUILDING_TYPES.IRON_MINE, // 16
        BUILDING_TYPES.IRON_MINE, // 17
        BUILDING_TYPES.IRON_MINE, // 18

        BUILDING_TYPES.RALLY_POINT, // 4

        BUILDING_TYPES.BARRACKS, // 16
        BUILDING_TYPES.BARRACKS, // 17

        BUILDING_TYPES.FARM, // 22
        BUILDING_TYPES.FARM, // 23
        BUILDING_TYPES.FARM, // 24
        BUILDING_TYPES.FARM, // 25

        BUILDING_TYPES.WAREHOUSE, // 22
        BUILDING_TYPES.WAREHOUSE, // 23

        BUILDING_TYPES.HEADQUARTER, // 11
        BUILDING_TYPES.HEADQUARTER, // 12

        BUILDING_TYPES.STATUE, // 4
        BUILDING_TYPES.STATUE, // 5

        BUILDING_TYPES.FARM, // 26
        BUILDING_TYPES.BARRACKS, // 18

        BUILDING_TYPES.HEADQUARTER, // 14
        BUILDING_TYPES.HEADQUARTER, // 15

        BUILDING_TYPES.FARM, // 27
        BUILDING_TYPES.BARRACKS, // 19

        BUILDING_TYPES.HEADQUARTER, // 15
        BUILDING_TYPES.HEADQUARTER, // 16

        BUILDING_TYPES.BARRACKS, // 20

        BUILDING_TYPES.HEADQUARTER, // 17
        BUILDING_TYPES.HEADQUARTER, // 18
        BUILDING_TYPES.HEADQUARTER, // 19
        BUILDING_TYPES.HEADQUARTER, // 20

        BUILDING_TYPES.ACADEMY, // 1
        
        BUILDING_TYPES.HEADQUARTER, // 21
        BUILDING_TYPES.HEADQUARTER, // 22
        BUILDING_TYPES.HEADQUARTER, // 23
        BUILDING_TYPES.HEADQUARTER, // 24
        BUILDING_TYPES.HEADQUARTER, // 25
        
        BUILDING_TYPES.PRECEPTORY, // 1

        BUILDING_TYPES.FARM, // 28
        BUILDING_TYPES.WAREHOUSE, // 23
        BUILDING_TYPES.WAREHOUSE, // 24
        BUILDING_TYPES.WAREHOUSE, // 25

        BUILDING_TYPES.MARKET, // 8
        BUILDING_TYPES.MARKET, // 9
        BUILDING_TYPES.MARKET, // 10

        BUILDING_TYPES.TIMBER_CAMP, // 13
        BUILDING_TYPES.CLAY_PIT, // 13
        BUILDING_TYPES.IRON_MINE, // 19

        BUILDING_TYPES.TIMBER_CAMP, // 14
        BUILDING_TYPES.CLAY_PIT, // 14
        BUILDING_TYPES.TIMBER_CAMP, // 15
        BUILDING_TYPES.CLAY_PIT, // 15

        BUILDING_TYPES.TIMBER_CAMP, // 16
        BUILDING_TYPES.TIMBER_CAMP, // 17

        BUILDING_TYPES.WALL, // 11
        BUILDING_TYPES.WALL, // 12

        BUILDING_TYPES.MARKET, // 11
        BUILDING_TYPES.MARKET, // 12
        BUILDING_TYPES.MARKET, // 13

        BUILDING_TYPES.TIMBER_CAMP, // 18
        BUILDING_TYPES.CLAY_PIT, // 16
        BUILDING_TYPES.TIMBER_CAMP, // 19
        BUILDING_TYPES.CLAY_PIT, // 17

        BUILDING_TYPES.TAVERN, // 7
        BUILDING_TYPES.TAVERN, // 8
        BUILDING_TYPES.TAVERN, // 9

        BUILDING_TYPES.WALL, // 13
        BUILDING_TYPES.WALL, // 14

        BUILDING_TYPES.TIMBER_CAMP, // 20
        BUILDING_TYPES.CLAY_PIT, // 18
        BUILDING_TYPES.IRON_MINE, // 20

        BUILDING_TYPES.TIMBER_CAMP, // 21
        BUILDING_TYPES.CLAY_PIT, // 19
        BUILDING_TYPES.IRON_MINE, // 21

        BUILDING_TYPES.BARRACKS, // 21
        BUILDING_TYPES.BARRACKS, // 22
        BUILDING_TYPES.BARRACKS, // 23

        BUILDING_TYPES.FARM, // 29
        BUILDING_TYPES.WAREHOUSE, // 26
        BUILDING_TYPES.WAREHOUSE, // 27

        BUILDING_TYPES.TAVERN, // 10
        BUILDING_TYPES.TAVERN, // 11
        BUILDING_TYPES.TAVERN, // 12

        BUILDING_TYPES.TIMBER_CAMP, // 22
        BUILDING_TYPES.CLAY_PIT, // 20
        BUILDING_TYPES.IRON_MINE, // 22

        BUILDING_TYPES.CLAY_PIT, // 21
        BUILDING_TYPES.CLAY_PIT, // 22

        BUILDING_TYPES.BARRACKS, // 24
        BUILDING_TYPES.BARRACKS, // 25

        BUILDING_TYPES.FARM, // 30
        BUILDING_TYPES.WAREHOUSE, // 28
        BUILDING_TYPES.WAREHOUSE, // 29

        BUILDING_TYPES.WALL, // 15
        BUILDING_TYPES.WALL, // 16
        BUILDING_TYPES.WALL, // 17
        BUILDING_TYPES.WALL, // 18

        BUILDING_TYPES.TAVERN, // 13
        BUILDING_TYPES.TAVERN, // 14

        BUILDING_TYPES.RALLY_POINT, // 5

        BUILDING_TYPES.WALL, // 19
        BUILDING_TYPES.WALL // 20
    ]
    
    Array.prototype.unshift.apply(
        defaultOrders['Full Village'],
        defaultOrders['Essential']
    )

    defaultOrders['Essential Without Wall'] =
        defaultOrders['Essential'].filter(function (building) {
            return building !== BUILDING_TYPES.WALL
        })

    defaultOrders['Full Wall'] = [
        BUILDING_TYPES.WALL,
        BUILDING_TYPES.WALL,
        BUILDING_TYPES.WALL,
        BUILDING_TYPES.WALL,
        BUILDING_TYPES.WALL,
        BUILDING_TYPES.WALL,
        BUILDING_TYPES.WALL,
        BUILDING_TYPES.WALL,
        BUILDING_TYPES.WALL,
        BUILDING_TYPES.WALL,
        BUILDING_TYPES.WALL,
        BUILDING_TYPES.WALL,
        BUILDING_TYPES.WALL,
        BUILDING_TYPES.WALL,
        BUILDING_TYPES.WALL,
        BUILDING_TYPES.WALL,
        BUILDING_TYPES.WALL,
        BUILDING_TYPES.WALL,
        BUILDING_TYPES.WALL,
        BUILDING_TYPES.WALL // 20
    ]

    return defaultOrders
})

define('two/builder/errorCodes', [], function () {
    return {
        SEQUENCE_NO_EXISTS: 'sequence_no_exists',
        SEQUENCE_EXISTS: 'sequence_exists',
        SEQUENCE_INVALID: 'sequence_invalid'
    }
})

define('two/builder/events', [], function () {
    angular.extend(eventTypeProvider, {
        BUILDER_QUEUE_JOB_STARTED: 'Builder/jobStarted',
        BUILDER_QUEUE_START: 'Builder/start',
        BUILDER_QUEUE_STOP: 'Builder/stop',
        BUILDER_QUEUE_UNKNOWN_SETTING: 'Builder/settings/unknownSetting',
        BUILDER_QUEUE_CLEAR_LOGS: 'Builder/clearLogs',
        BUILDER_QUEUE_BUILDING_SEQUENCES_UPDATED: 'Builder/buildingOrders/updated',
        BUILDER_QUEUE_BUILDING_SEQUENCES_ADDED: 'Builder/buildingOrders/added',
        BUILDER_QUEUE_BUILDING_SEQUENCES_REMOVED: 'Builder/buildingOrders/removed',
        BUILDER_QUEUE_SETTINGS_CHANGE: 'Builder/settings/change'
    })
})


define('two/builder/settingsMap', [
    'two/builder/defaultOrders',
    'two/builder/settings'
], function (
    DEFAULT_ORDERS,
    SETTINGS
) {
    return {
        [SETTINGS.GROUP_VILLAGES]: {
            default: '',
            inputType: 'select'
        },
        [SETTINGS.ACTIVE_SEQUENCE]: {
            default: 'Essential',
            inputType: 'select'
        },
        [SETTINGS.BUILDING_SEQUENCES]: {
            default: DEFAULT_ORDERS,
            inputType: 'buildingOrder'
        }
    }
})

define('two/builder/settings', [], function () {
    return {
        GROUP_VILLAGES: 'group_villages',
        ACTIVE_SEQUENCE: 'building_sequence',
        BUILDING_SEQUENCES: 'building_orders',
    }
})

require([
    'helper/i18n',
    'two/ready',
    'two/builder',
    'two/builder/ui',
    'two/builder/events'
], function (
    i18n,
    ready,
    builderQueue,
    builderQueueInterface
) {
    if (builderQueue.isInitialized()) {
        return false
    }

    var updateModuleLang = function () {
        var langs = {"en_us":{"builder_queue":{"started":"BuilderQueue started","stopped":"BuilderQueue stopped","settings":"Settings","settings_village_groups":"Build only on villages with the group","settings_building_sequence":"Building sequence","settings_building_sequence_final":"Buildings final levels","settings_saved":"Settings saved!","logs_no_builds":"No builds started","logs_clear":"Clear logs","sequences":"Sequences","sequences_move_up":"Move up","sequences_move_down":"Move down","sequences_add_building":"Add building","sequences_select_edit":"Select a sequence to edit","sequences_edit_sequence":"Edit sequence","sequence_updated":"Sequence %d updated.","sequence_added":"Building sequence %d added","select_group":"Select a group","add_building_success":"%d has added at position %d","add_building_limit_exceeded":"%d reached maximum level (%d)","position":"Position","remove_building":"Remove building from list","clone":"Clone","tooltip_clone":"Crate a new sequence from the selected sequence","tooltip_remove_sequence":"Remove selected sequence","name_sequence_min_lenght":"The sequence name must have at least 3 character.","sequence_created":"New sequence %d created.","sequence_removed":"Sequence %d removed.","error_sequence_exists":"This sequence already exists.","error_sequence_no_exists":"This sequence not exists.","error_sequence_invalid":"Some sequence's value is invalid."},"builder_queue_add_building_modal":{"title":"Add new building"},"builder_queue_name_sequence_modal":{"title":"Sequence name"},"builder_queue_remove_sequence_modal":{"title":"Remove sequence","text":"Are you sure to remove this sequence? If this sequence is the active one, another sequence will be selected and the BuilderQueue stopped."}},"pl_pl":{"builder_queue":{"started":"BuilderQueue uruchomiony","stopped":"BuilderQueue zatrzymany","settings":"Ustawienia","settings_village_groups":"Buduj w wioskach z grupy","settings_building_sequence":"Szablon kolejki budowy","settings_building_sequence_final":"Buildings final levels","settings_saved":"Ustawienia zapisane!","logs_no_builds":"Nie rozpoczęto żadnej rozbudowy","logs_clear":"Wyczyść logi","sequences":"Sequences","sequences_move_up":"Move up","sequences_move_down":"Move down","sequences_add_building":"Add building","sequences_select_edit":"Select a sequence to edit","sequences_edit_sequence":"Edit sequence","sequence_updated":"Sequence %d updated.","sequence_added":"Building sequence %d added","select_group":"Select a group","add_building_success":"%d has added at position %d","add_building_limit_exceeded":"%d reached maximum level (%d)","position":"Position","remove_building":"Remove building from list","clone":"Clone","tooltip_clone":"Crate a new sequence from the selected sequence","tooltip_remove_sequence":"Remove selected sequence","name_sequence_min_lenght":"The sequence name must have at least 3 character.","sequence_created":"New sequence %d created.","sequence_removed":"Sequence %d removed.","error_sequence_exists":"This sequence already exists.","error_sequence_no_exists":"This sequence not exists.","error_sequence_invalid":"Some sequence's value is invalid."},"builder_queue_add_building_modal":{"title":"Add new building"},"builder_queue_name_sequence_modal":{"title":"Sequence name"},"builder_queue_remove_sequence_modal":{"title":"Remove sequence","text":"Are you sure to remove this sequence? If this sequence is the active one, another sequence will be selected and the BuilderQueue stopped."}},"pt_br":{"builder_queue":{"started":"BuilderQueue iniciado","stopped":"BuilderQueue parado","settings":"Configurações","settings_village_groups":"Construir apenas em aldeias do grupo","settings_building_sequence":"Sequência de construções","settings_building_sequence_final":"Nível final das construções","settings_saved":"Configurações salvas!","logs_no_builds":"Nenhuma construção iniciada","logs_clear":"Limpar registros","sequences":"Sequências","sequences_move_up":"Mover acima","sequences_move_down":"Mover abaixo","sequences_add_building":"Adicionar edifício","sequences_select_edit":"Selecione uma sequência para editar","sequences_edit_sequence":"Editar sequência","sequence_updated":"Sequência %d atualizada.","sequence_added":"Sequência %d adicionada","select_group":"Selecione um grupo","add_building_success":"%d foi adicionado à posição %d","add_building_limit_exceeded":"%d chegou ao nível máximo (%d)","position":"Posição","remove_building":"Remover edifício da lista","clone":"Clonar","tooltip_clone":"Criar uma nova sequência a partir da sequência selecionada","tooltip_remove_sequence":"Remover sequência selecionada","name_sequence_min_lenght":"O nome da sequência deve ter pelo menos 3 caracteres.","sequence_created":"Nova sequência %d criada.","sequence_removed":"Sequência %d removida.","error_sequence_exists":"Esta sequência já existe.","error_sequence_no_exists":"Esta sequência não existe.","error_sequence_invalid":"Algum valor da sequência é inválido."},"builder_queue_add_building_modal":{"title":"Adicionar novo edifício"},"builder_queue_name_sequence_modal":{"title":"Nomear sequência"},"builder_queue_remove_sequence_modal":{"title":"Remover sequência","text":"Tem certeza que deseja remover esta sequência? Se esta sequência estiver ativa, outra será selecionada e o BuilderQueue será parado."}}}
        var current = $rootScope.loc.ale
        var data = current in langs
            ? langs[current]
            : langs['en_us']

        i18n.setJSON(data)
    }

    ready(function () {
        updateModuleLang()
        builderQueue.init()
        builderQueueInterface()
    })
})

define('two/builder/ui', [
    'two/builder',
    'two/ui2',
    'two/FrontButton',
    'queues/EventQueue',
    'two/utils',
    'conf/buildingTypes',
    'helper/time',
    'two/ready',
    'two/builder/settings',
    'two/builder/settingsMap',
    'two/builder/errorCodes',
    'two/EventScope'
], function (
    builderQueue,
    interfaceOverflow,
    FrontButton,
    eventQueue,
    utils,
    BUILDING_TYPES,
    $timeHelper,
    ready,
    SETTINGS,
    SETTINGS_MAP,
    ERROR_CODES,
    EventScope
) {
    var eventScope
    var $scope
    var textObject = 'builder_queue'
    var textObjectCommon = 'common'
    var groupList = modelDataService.getGroupList()
    var groups = []
    var buildingsLevelPoints = {}
    var running = false
    var gameDataBuildings
    var editorView = {
        modal: {}
    }
    var settingsView = {}

    var TAB_TYPES = {
        SETTINGS: 'settings',
        SEQUENCES: 'sequences',
        LOGS: 'logs'
    }

    var parseSettings = function (rawSettings) {
        var settings = angular.copy(rawSettings)
        var groups = groupList.getGroups()
        var selectedGroup = groups[settings[SETTINGS.GROUP_VILLAGES]]

        if (selectedGroup) {
            settings[SETTINGS.GROUP_VILLAGES] = {
                name: groups[settings[SETTINGS.GROUP_VILLAGES]].name,
                value: settings[SETTINGS.GROUP_VILLAGES]
            }
        } else {
            settings[SETTINGS.GROUP_VILLAGES] = disabledOption()
        }

        settings[SETTINGS.ACTIVE_SEQUENCE] = {
            name: settings[SETTINGS.ACTIVE_SEQUENCE],
            value: settings[SETTINGS.ACTIVE_SEQUENCE]
        }

        return settings
    }

    var disabledOption = function () {
        return {
            name: $filter('i18n')('disabled', $rootScope.loc.ale, textObjectCommon),
            value: false
        }
    }

    var buildingLevelReached = function (building, level) {
        var buildingData = modelDataService.getSelectedVillage().getBuildingData()
        return buildingData.getBuildingLevel(building) >= level
    }

    var buildingLevelProgress = function (building, level) {
        var queue = modelDataService.getSelectedVillage().getBuildingQueue().getQueue()
        var progress = false

        queue.some(function (job) {
            if (job.building === building && job.level === level) {
                return progress = true
            }
        })

        return progress
    }

    /**
     * Calculate the total of points accumulated ultil the specified level.
     */
    var getLevelScale = function (factor, base, level) {
        return level ? parseInt(Math.round(factor * Math.pow(base, level - 1)), 10) : 0
    }

    var moveArrayItem = function (obj, oldIndex, newIndex) {
        if (newIndex >= obj.length) {
            var i = newIndex - obj.length + 1
            
            while (i--) {
                obj.push(undefined)
            }
        }

        obj.splice(newIndex, 0, obj.splice(oldIndex, 1)[0])
    }

    var parseBuildingSequence = function (sequence) {
        return sequence.map(function (item) {
            return item.building
        })
    }

    var createBuildingSequence = function (sequenceId, sequence) {
        var error = builderQueue.addBuildingSequence(sequenceId, sequence)

        switch (error) {
        case ERROR_CODES.SEQUENCE_EXISTS:
            utils.emitNotif('error', $filter('i18n')('error_sequence_exists', $rootScope.loc.ale, textObject))
            return false

            break
        case ERROR_CODES.SEQUENCE_INVALID:
            utils.emitNotif('error', $filter('i18n')('error_sequence_invalid', $rootScope.loc.ale, textObject))
            return false

            break
        }

        return true
    }

    var selectSome = function (obj) {
        for (var i in obj) {
            if (obj.hasOwnProperty(i)) {
                return i
            }
        }

        return false
    }

    settingsView.generateBuildingSequence = function () {
        var sequenceId = $scope.settings[SETTINGS.ACTIVE_SEQUENCE].value
        var buildingSequenceRaw = $scope.settings[SETTINGS.BUILDING_SEQUENCES][sequenceId]
        var buildingData = modelDataService.getGameData().getBuildings()
        var buildingLevels = {}
        var building
        var level
        var state
        var price

        for (building in BUILDING_TYPES) {
            buildingLevels[BUILDING_TYPES[building]] = 0
        }

        settingsView.buildingSequence = buildingSequenceRaw.map(function (building) {
            level = ++buildingLevels[building]
            price = buildingData[building].individual_level_costs[level]
            state = 'not-reached'

            if (buildingLevelReached(building, level)) {
                state = 'reached'
            } else if (buildingLevelProgress(building, level)) {
                state = 'progress'
            }

            return {
                level: level,
                price: buildingData[building].individual_level_costs[level],
                building: building,
                duration: $timeHelper.readableSeconds(price.build_time),
                levelPoints: buildingsLevelPoints[building][level - 1],
                state: state
            }
        })
    }

    settingsView.generateBuildingSequenceFinal = function (_sequenceId) {
        var selectedSequence = $scope.settings[SETTINGS.ACTIVE_SEQUENCE].value
        var sequenceBuildings = $scope.settings[SETTINGS.BUILDING_SEQUENCES][_sequenceId || selectedSequence]
        var sequenceObj = {}
        var sequence = []
        var building

        for (building in gameDataBuildings) {
            sequenceObj[building] = {
                level: 0,
                order: gameDataBuildings[building].order
            }
        }

        sequenceBuildings.forEach(function (building) {
            sequenceObj[building].level++
        })

        for (building in sequenceObj) {
            if (sequenceObj[building].level !== 0) {
                sequence.push({
                    building: building,
                    level: sequenceObj[building].level,
                    order: sequenceObj[building].order
                })
            }
        }

        settingsView.buildingSequenceFinal = sequence
    }

    settingsView.updateVisibleBuildingSequence = function () {
        var offset = $scope.pagination.buildingSequence.offset
        var limit = $scope.pagination.buildingSequence.limit

        settingsView.visibleBuildingSequence = settingsView.buildingSequence.slice(offset, offset + limit)
        $scope.pagination.buildingSequence.count = settingsView.buildingSequence.length
    }

    settingsView.generateBuildingsLevelPoints = function () {
        var $gameData = modelDataService.getGameData()
        var buildingName
        var buildingData
        var buildingTotalPoints
        var levelPoints
        var currentLevelPoints
        var level

        for(buildingName in $gameData.data.buildings) {
            buildingData = $gameData.getBuildingDataForBuilding(buildingName)
            buildingTotalPoints = 0
            buildingsLevelPoints[buildingName] = []

            for (level = 1; level <= buildingData.max_level; level++) {
                currentLevelPoints  = getLevelScale(buildingData.points, buildingData.points_factor, level)
                levelPoints = currentLevelPoints - buildingTotalPoints
                buildingTotalPoints += levelPoints
                buildingsLevelPoints[buildingName].push(levelPoints)
            }
        }
    }

    editorView.moveUp = function () {
        var copy = angular.copy(editorView.buildingSequence)
        var index
        var item

        for (index = 0; index < copy.length; index++) {
            item = copy[index]

            if (!item.checked) {
                continue
            }

            if (index === 0) {
                continue
            }

            if (copy[index - 1].checked) {
                continue
            }

            if (copy[index - 1].building === item.building) {
                copy[index - 1].level++
                item.level--
            }

            moveArrayItem(copy, index, index - 1)
        }

        editorView.buildingSequence = copy
        editorView.updateVisibleBuildingSequence()
    }

    editorView.moveDown = function () {
        var copy = angular.copy(editorView.buildingSequence)
        var index
        var item

        for (index = copy.length - 1; index >= 0; index--) {
            item = copy[index]

            if (!item.checked) {
                continue
            }

            if (index === copy.length - 1) {
                continue
            }

            if (copy[index + 1].checked) {
                continue
            }

            if (copy[index + 1].building === item.building) {
                copy[index + 1].level--
                item.level++
            }

            moveArrayItem(copy, index, index + 1)
        }

        editorView.buildingSequence = copy
        editorView.updateVisibleBuildingSequence()
    }

    editorView.addBuilding = function (building, position) {
        var index = position - 1
        var newSequence = editorView.buildingSequence.slice()
        var updated

        newSequence.splice(index, 0, {
            level: null,
            building: building,
            checked: false
        })

        newSequence = editorView.updateLevels(newSequence, building)

        if (!newSequence) {
            return false
        }

        editorView.buildingSequence = newSequence
        editorView.updateVisibleBuildingSequence()

        return true
    }

    editorView.removeBuilding = function (index) {
        var building = editorView.buildingSequence[index].building

        editorView.buildingSequence.splice(index, 1)
        editorView.buildingSequence = editorView.updateLevels(editorView.buildingSequence, building)

        editorView.updateVisibleBuildingSequence()
    }

    editorView.updateLevels = function (sequence, building) {
        var buildingLevel = 0
        var modifiedSequence = []
        var i
        var item
        var limitExceeded = false

        for (i = 0; i < sequence.length; i++) {
            item = sequence[i]

            if (item.building === building) {
                buildingLevel++

                if (buildingLevel > gameDataBuildings[building].max_level) {
                    limitExceeded = true
                    break
                }

                modifiedSequence.push({
                    level: buildingLevel,
                    building: building,
                    checked: false
                })
            } else {
                modifiedSequence.push(item)
            }
        }

        if (limitExceeded) {
            return false
        }

        return modifiedSequence
    }

    editorView.generateBuildingSequence = function () {
        var sequenceId = editorView.selectedSequence.value
        var buildingSequenceRaw = $scope.settings[SETTINGS.BUILDING_SEQUENCES][sequenceId]
        var buildingLevels = {}
        var building

        for (building in BUILDING_TYPES) {
            buildingLevels[BUILDING_TYPES[building]] = 0
        }

        editorView.buildingSequence = buildingSequenceRaw.map(function (building) {
            return {
                level: ++buildingLevels[building],
                building: building,
                checked: false
            }
        })
    }

    editorView.updateVisibleBuildingSequence = function () {
        var offset = $scope.pagination.buildingSequenceEditor.offset
        var limit = $scope.pagination.buildingSequenceEditor.limit

        editorView.visibleBuildingSequence = editorView.buildingSequence.slice(offset, offset + limit)
        $scope.pagination.buildingSequenceEditor.count = editorView.buildingSequence.length
    }

    editorView.updateBuildingSequence = function () {
        var selectedSequence = editorView.selectedSequence.value
        var parsedSequence = parseBuildingSequence(editorView.buildingSequence)
        var error = builderQueue.updateBuildingSequence(selectedSequence, parsedSequence)

        switch (error) {
        case ERROR_CODES.SEQUENCE_NO_EXISTS:
            utils.emitNotif('error', $filter('i18n')('error_sequence_no_exits', $rootScope.loc.ale, textObject))

            break
        case ERROR_CODES.SEQUENCE_INVALID:
            utils.emitNotif('error', $filter('i18n')('error_sequence_invalid', $rootScope.loc.ale, textObject))

            break
        }
    }

    editorView.modal.removeSequence = function () {
        var modalScope = $rootScope.$new()
        var textObject = 'builder_queue_remove_sequence_modal'

        modalScope.title = $filter('i18n')('title', $rootScope.loc.ale, textObject)
        modalScope.text = $filter('i18n')('text', $rootScope.loc.ale, textObject)
        modalScope.submitText = $filter('i18n')('remove', $rootScope.loc.ale, textObjectCommon)
        modalScope.cancelText = $filter('i18n')('cancel', $rootScope.loc.ale, textObjectCommon)

        modalScope.submit = function () {
            modalScope.closeWindow()
            builderQueue.removeSequence(editorView.selectedSequence.value)
        }

        modalScope.cancel = function () {
            modalScope.closeWindow()
        }

        windowManagerService.getModal('modal_attention', modalScope)
    }

    editorView.modal.addBuilding = function () {
        var modalScope = $rootScope.$new()
        var building

        modalScope.buildings = []
        modalScope.position = 1
        modalScope.indexLimit = editorView.buildingSequence.length + 1
        modalScope.selectedBuilding = {
            name: $filter('i18n')(BUILDING_TYPES.HEADQUARTER, $rootScope.loc.ale, 'building_names'),
            value: BUILDING_TYPES.HEADQUARTER
        }

        for (building in gameDataBuildings) {
            modalScope.buildings.push({
                name: $filter('i18n')(building, $rootScope.loc.ale, 'building_names'),
                value: building
            })
        }

        modalScope.add = function () {
            var building = modalScope.selectedBuilding.value
            var position = modalScope.position
            var buildingName = $filter('i18n')(building, $rootScope.loc.ale, 'building_names')
            var buildingLimit = gameDataBuildings[building].max_level

            if (editorView.addBuilding(building, position)) {
                modalScope.closeWindow()
                utils.emitNotif('success', $filter('i18n')('add_building_success', $rootScope.loc.ale, textObject, buildingName, position))
            } else {
                utils.emitNotif('error', $filter('i18n')('add_building_limit_exceeded', $rootScope.loc.ale, textObject, buildingName, buildingLimit))
            }
        }

        windowManagerService.getModal('!twoverflow_builder_queue_add_building_modal', modalScope)
    }

    editorView.modal.nameSequence = function () {
        var modalScope = $rootScope.$new()
        var selectedSequenceName = editorView.selectedSequence.name
        var selectedSequence = $scope.settings[SETTINGS.BUILDING_SEQUENCES][selectedSequenceName]
        
        modalScope.name = selectedSequenceName

        modalScope.submit = function () {
            if (modalScope.name.length < 3) {
                utils.emitNotif('error', $filter('i18n')('name_sequence_min_lenght', $rootScope.loc.ale, textObject))
                return false
            }

            var success = createBuildingSequence(modalScope.name, selectedSequence)

            if (success) {
                modalScope.closeWindow()
            }
        }

        windowManagerService.getModal('!twoverflow_builder_queue_name_sequence_modal', modalScope)
    }

    var selectTab = function (tabType) {
        $scope.selectedTab = tabType
    }

    var saveSettings = function () {
        var settings = angular.copy($scope.settings)
        var id

        for (id in SETTINGS_MAP) {
            if (SETTINGS_MAP[id].inputType === 'select') {
                settings[id] = settings[id].value
            }
        }

        builderQueue.updateSettings(settings)
    }

    var switchBuilder = function () {
        if (builderQueue.isRunning()) {
            builderQueue.stop()
        } else {
            builderQueue.start()
        }
    }

    var clearLogs = function () {
        builderQueue.clearLogs()
    }

    var eventHandlers = {
        updateGroups: function () {
            $scope.groups = utils.obj2selectOptions(groupList.getGroups(), true)
            $scope.groups.unshift(disabledOption())
        },
        updateSequences: function () {
            var sequenceList = []
            var sequences = $scope.settings[SETTINGS.BUILDING_SEQUENCES]
            var id

            for (id in sequences) {
                sequenceList.push({
                    name: id,
                    value: id
                })
            }

            $scope.sequences = sequenceList
        },
        generateBuildingSequences: function () {
            settingsView.generateBuildingSequence()
            settingsView.generateBuildingSequenceFinal()
            settingsView.updateVisibleBuildingSequence()
        },
        generateBuildingSequencesEditor: function () {
            editorView.generateBuildingSequence()
            editorView.updateVisibleBuildingSequence()
        },
        updateLogs: function () {
            $scope.logs = builderQueue.getLogs()
        },
        buildingSequenceUpdate: function (event, sequenceId) {
            var settings = builderQueue.getSettings()

            $scope.settings[SETTINGS.BUILDING_SEQUENCES][sequenceId] = settings[SETTINGS.BUILDING_SEQUENCES][sequenceId]

            if ($scope.settings[SETTINGS.ACTIVE_SEQUENCE].value === sequenceId) {
                settingsView.generateBuildingSequence()
                settingsView.generateBuildingSequenceFinal()
                settingsView.updateVisibleBuildingSequence()
            }

            utils.emitNotif('success', $filter('i18n')('sequence_updated', $rootScope.loc.ale, textObject, sequenceId))
        },
        buildingSequenceAdd: function (event, sequenceId) {
            var settings = builderQueue.getSettings()
            
            $scope.settings[SETTINGS.BUILDING_SEQUENCES][sequenceId] = settings[SETTINGS.BUILDING_SEQUENCES][sequenceId]
            eventHandlers.updateSequences()
            utils.emitNotif('success', $filter('i18n')('sequence_created', $rootScope.loc.ale, textObject, sequenceId))
        },
        buildingSequenceRemoved: function (event, sequenceId) {
            var substituteSequence

            delete $scope.settings[SETTINGS.BUILDING_SEQUENCES][sequenceId]

            substituteSequence = selectSome($scope.settings[SETTINGS.BUILDING_SEQUENCES])
            editorView.selectedSequence = { name: substituteSequence, value: substituteSequence }
            eventHandlers.updateSequences()
            editorView.generateBuildingSequence()

            if ($scope.settings[SETTINGS.ACTIVE_SEQUENCE].value === sequenceId) {
                $scope.settings[SETTINGS.ACTIVE_SEQUENCE] = { name: substituteSequence, value: substituteSequence }
                settingsView.generateBuildingsLevelPoints()
                settingsView.generateBuildingSequence()
                settingsView.generateBuildingSequenceFinal()
            }

            utils.emitNotif('success', $filter('i18n')('sequence_removed', $rootScope.loc.ale, textObject, sequenceId))
        },
        saveSettings: function () {
            utils.emitNotif('success', $filter('i18n')('settings_saved', $rootScope.loc.ale, textObject))
        },
        started: function () {
            $scope.running = true
        },
        stopped: function () {
            $scope.running = false
        }
    }

    var init = function () {
        gameDataBuildings = modelDataService.getGameData().getBuildings()

        var opener = new FrontButton('Builder', {
            classHover: false,
            classBlur: false,
            onClick: buildWindow
        })

        eventQueue.register(eventTypeProvider.BUILDER_QUEUE_START, function () {
            running = true
            opener.$elem.classList.remove('btn-green')
            opener.$elem.classList.add('btn-red')
            utils.emitNotif('success', $filter('i18n')('started', $rootScope.loc.ale, textObject))
        })

        eventQueue.register(eventTypeProvider.BUILDER_QUEUE_STOP, function () {
            running = false
            opener.$elem.classList.remove('btn-red')
            opener.$elem.classList.add('btn-green')
            utils.emitNotif('success', $filter('i18n')('stopped', $rootScope.loc.ale, textObject))
        })

        interfaceOverflow.addTemplate('twoverflow_builder_queue_window', `<div id="two-builder-queue" class="win-content two-window"><header class="win-head"><h2>BuilderQueue</h2><ul class="list-btn"><li><a href="#" class="size-34x34 btn-red icon-26x26-close" ng-click="closeWindow()"></a></li></ul></header><div class="win-main small-select" scrollbar=""><div class="tabs tabs-bg"><div class="tabs-three-col"><div class="tab" ng-click="selectTab(TAB_TYPES.SETTINGS)" ng-class="{'tab-active': selectedTab == TAB_TYPES.SETTINGS}"><div class="tab-inner"><div ng-class="{'box-border-light': selectedTab === TAB_TYPES.SETTINGS}"><a href="#" ng-class="{'btn-icon btn-orange': selectedTab !== TAB_TYPES.SETTINGS}">{{ TAB_TYPES.SETTINGS | i18n:loc.ale:textObjectCommon }}</a></div></div></div><div class="tab" ng-click="selectTab(TAB_TYPES.SEQUENCES)" ng-class="{'tab-active': selectedTab == TAB_TYPES.SEQUENCES}"><div class="tab-inner"><div ng-class="{'box-border-light': selectedTab === TAB_TYPES.SEQUENCES}"><a href="#" ng-class="{'btn-icon btn-orange': selectedTab !== TAB_TYPES.SEQUENCES}">{{ TAB_TYPES.SEQUENCES | i18n:loc.ale:textObject }}</a></div></div></div><div class="tab" ng-click="selectTab(TAB_TYPES.LOGS)" ng-class="{'tab-active': selectedTab == TAB_TYPES.LOGS}"><div class="tab-inner"><div ng-class="{'box-border-light': selectedTab === TAB_TYPES.LOGS}"><a href="#" ng-class="{'btn-icon btn-orange': selectedTab !== TAB_TYPES.LOGS}">{{ TAB_TYPES.LOGS | i18n:loc.ale:textObjectCommon }}</a></div></div></div></div></div><div class="box-paper footer"><div class="scroll-wrap"><div ng-show="selectedTab === TAB_TYPES.SETTINGS"><h5 class="twx-section">{{ 'settings' | i18n:loc.ale:textObject }}</h5><table class="tbl-border-light tbl-striped"><colgroup><col width="50%"><col></colgroup><tbody><tr><td><span class="ff-cell-fix">{{ 'settings_village_groups' | i18n:loc.ale:textObject }}</span></td><td><div select="" list="groups" selected="settings[SETTINGS.GROUP_VILLAGES]" drop-down="true"></div></td></tr><tr><td><span class="ff-cell-fix">{{ 'settings_building_sequence' | i18n:loc.ale:textObject }}</span></td><td><div select="" list="sequences" selected="settings[SETTINGS.ACTIVE_SEQUENCE]" drop-down="true"></div></td></tr></tbody></table><h5 class="twx-section">{{ 'settings_building_sequence' | i18n:loc.ale:textObject }}</h5><div class="page-wrap" pagination="pagination.buildingSequence"></div><table class="tbl-border-light header-center building-sequence"><colgroup><col width="5%"><col width="30%"><col width="7%"><col width="13%"><col width="8%"><col></colgroup><tr><th tooltip="" tooltip-content="{{ 'position' | i18n:loc.ale:textObject }}">#</th><th>{{ 'building' | i18n:loc.ale:textObjectCommon }}</th><th>{{ 'level' | i18n:loc.ale:textObjectCommon }}</th><th>{{ 'duration' | i18n:loc.ale:textObjectCommon }}</th><th>{{ 'points' | i18n:loc.ale:textObjectCommon }}</th><th>{{ 'costs' | i18n:loc.ale:textObjectCommon }}</th></tr><tr ng-repeat="item in settingsView.visibleBuildingSequence track by $index" class="{{ item.state }}"><td>{{ pagination.buildingSequence.offset + $index + 1 }}</td><td><span class="building-icon icon-20x20-building-{{ item.building }}"></span> {{ item.building | i18n:loc.ale:'building_names' }}</td><td>{{ item.level }}</td><td>{{ item.duration }}</td><td class="green">+{{ item.levelPoints }}</td><td><span class="icon-26x26-resource-wood"></span> {{ item.price.wood }} <span class="icon-26x26-resource-clay"></span> {{ item.price.clay }} <span class="icon-26x26-resource-iron"></span> {{ item.price.iron }}</td></tr></table><div class="page-wrap" pagination="pagination.buildingSequence"></div><h5 class="twx-section">{{ 'settings_building_sequence_final' | i18n:loc.ale:textObject }}</h5><table class="tbl-border-light tbl-striped header-center building-sequence-final"><colgroup><col width="5%"><col width="70%"><col></colgroup><tr><th colspan="2">{{ 'building' | i18n:loc.ale:textObjectCommon }}</th><th>{{ 'level' | i18n:loc.ale:textObjectCommon }}</th></tr><tr ng-repeat="item in settingsView.buildingSequenceFinal | orderBy:'order'"><td><span class="building-icon icon-20x20-building-{{ item.building }}"></span></td><td>{{ item.building | i18n:loc.ale:'building_names' }}</td><td>{{ item.level }}</td></tr></table></div><div ng-show="selectedTab === TAB_TYPES.SEQUENCES"><h5 class="twx-section">{{ 'sequences_edit_sequence' | i18n:loc.ale:textObject }}</h5><table class="tbl-border-light tbl-striped editor-select-sequence"><colgroup><col width="50%"><col></colgroup><tbody><tr><td><span class="ff-cell-fix">{{ 'sequences_select_edit' | i18n:loc.ale:textObject }}</span></td><td><div class="select-sequence-editor" select="" list="sequences" selected="editorView.selectedSequence" drop-down="true"></div><a class="btn btn-orange clone-sequence" ng-click="editorView.modal.nameSequence()" tooltip="" tooltip-content="{{ 'tooltip_clone' | i18n:loc.ale:textObject }}">{{ 'clone' | i18n:loc.ale:textObject }}</a> <a href="#" class="btn-red remove-sequence icon-20x20-close" ng-click="editorView.modal.removeSequence()" tooltip="" tooltip-content="{{ 'tooltip_remove_sequence' | i18n:loc.ale:textObject }}"></a></td></tr></tbody></table><div class="page-wrap" pagination="pagination.buildingSequenceEditor"></div><table class="tbl-border-light tbl-striped header-center building-sequence-editor"><colgroup><col width="5%"><col width="5%"><col><col width="7%"><col width="10%"></colgroup><tr><th></th><th tooltip="" tooltip-content="{{ 'position' | i18n:loc.ale:textObject }}">#</th><th>{{ 'building' | i18n:loc.ale:textObjectCommon }}</th><th>{{ 'level' | i18n:loc.ale:textObjectCommon }}</th><th>{{ 'actions' | i18n:loc.ale:textObjectCommon }}</th></tr><tr ng-repeat="item in editorView.visibleBuildingSequence track by $index" ng-class="{'selected': item.checked}"><td><label class="size-26x26 btn-orange icon-26x26-checkbox" ng-class="{'icon-26x26-checkbox-checked': item.checked}"><input type="checkbox" ng-model="item.checked"></label></td><td>{{ pagination.buildingSequenceEditor.offset + $index + 1 }}</td><td><span class="building-icon icon-20x20-building-{{ item.building }}"></span> {{ item.building | i18n:loc.ale:'building_names' }}</td><td>{{ item.level }}</td><td><a href="#" class="size-20x20 btn-red icon-20x20-close" ng-click="editorView.removeBuilding(pagination.buildingSequenceEditor.offset + $index)" tooltip="" tooltip-content="{{ 'remove_building' | i18n:loc.ale:textObject }}"></a></td></tr></table><div class="page-wrap" pagination="pagination.buildingSequenceEditor"></div></div><div ng-show="selectedTab === TAB_TYPES.LOGS"><table class="tbl-border-light tbl-striped header-center"><colgroup><col width="40%"><col width="30%"><col width="5%"><col width="25%"><col></colgroup><thead><tr><th>{{ 'village' | i18n:loc.ale:textObjectCommon }}</th><th>{{ 'building' | i18n:loc.ale:textObjectCommon }}</th><th>{{ 'level' | i18n:loc.ale:textObjectCommon }}</th><th>{{ 'started' | i18n:loc.ale:textObjectCommon }}</th></tr></thead><tbody class="buildLog"><tr class="noBuilds"><td colspan="4">{{ 'logs_no_builds' | i18n:loc.ale:textObject }}</td></tr></tbody></table></div></div></div></div><footer class="win-foot"><ul class="list-btn list-center"><li ng-show="selectedTab === TAB_TYPES.SETTINGS"><a href="#" class="btn-border btn-orange" ng-click="saveSettings()">{{ 'save' | i18n:loc.ale:textObjectCommon }}</a></li><li ng-show="selectedTab === TAB_TYPES.SETTINGS"><a href="#" ng-class="{false:'btn-green', true:'btn-red'}[running]" class="btn-border" ng-click="switchBuilder()"><span ng-show="running">{{ 'pause' | i18n:loc.ale:textObjectCommon }}</span> <span ng-show="!running">{{ 'start' | i18n:loc.ale:textObjectCommon }}</span></a></li><li ng-show="selectedTab === TAB_TYPES.LOGS"><a href="#" class="btn-border btn-orange" ng-click="clearLogs()">{{ 'clear_logs' | i18n:loc.ale:textObject }}</a></li><li ng-show="selectedTab === TAB_TYPES.SEQUENCES"><a href="#" class="btn-border btn-orange" ng-click="editorView.moveUp()">{{ 'sequences_move_up' | i18n:loc.ale:textObject }}</a></li><li ng-show="selectedTab === TAB_TYPES.SEQUENCES"><a href="#" class="btn-border btn-orange" ng-click="editorView.moveDown()">{{ 'sequences_move_down' | i18n:loc.ale:textObject }}</a></li><li ng-show="selectedTab === TAB_TYPES.SEQUENCES"><a href="#" class="btn-border btn-green" ng-click="editorView.modal.addBuilding()">{{ 'sequences_add_building' | i18n:loc.ale:textObject }}</a></li><li ng-show="selectedTab === TAB_TYPES.SEQUENCES"><a href="#" class="btn-border btn-red" ng-click="editorView.updateBuildingSequence()">{{ 'save' | i18n:loc.ale:textObjectCommon }}</a></li></ul></footer></div>`)
        interfaceOverflow.addTemplate('twoverflow_builder_queue_add_building_modal', `<div id="add-building-modal" class="win-content" ng-init="textObject = 'builder_queue_add_building_modal'"><header class="win-head"><h3>{{ 'title' | i18n:loc.ale:textObject }}</h3><ul class="list-btn sprite"><li><a href="#" class="btn-red icon-26x26-close" ng-click="closeWindow()"></a></li></ul></header><div class="win-main" scrollbar=""><div class="box-paper"><div class="scroll-wrap unit-operate-slider"><table class="tbl-border-light tbl-striped header-center"><colgroup><col width="15%"><col><col width="15%"></colgroup><tr><td>{{ 'building' | i18n:loc.ale:'common' }}</td><td colspan="2"><div select="" list="buildings" selected="selectedBuilding" drop-down="true"></div></td></tr><tr><td>{{ 'position' | i18n:loc.ale:'builder_queue' }}</td><td><div range-slider="" min="1" max="indexLimit" value="position" enabled="true"></div></td><td><input type="text" class="input-border text-center" ng-model="position"></td></tr></table></div></div></div><footer class="win-foot sprite-fill"><ul class="list-btn list-center"><li><a href="#" class="btn-red btn-border btn-premium" ng-click="closeWindow()">{{ 'cancel' | i18n:loc.ale:'common' }}</a></li><li><a href="#" class="btn-orange btn-border" ng-click="add()">{{ 'add' | i18n:loc.ale:'common' }}</a></li></ul></footer></div>`)
        interfaceOverflow.addTemplate('twoverflow_builder_queue_name_sequence_modal', `<div id="name-sequence-modal" class="win-content" ng-init="textObject = 'builder_queue_name_sequence_modal'"><header class="win-head"><h3>{{ 'title' | i18n:loc.ale:textObject }}</h3><ul class="list-btn sprite"><li><a href="#" class="btn-red icon-26x26-close" ng-click="closeWindow()"></a></li></ul></header><div class="win-main" scrollbar=""><div class="box-paper"><div class="scroll-wrap"><div class="box-border-light input-wrapper name_preset"><form ng-submit="submit()"><input type="text" focus="true" ng-model="name" minlength="3"></form></div></div></div></div><footer class="win-foot sprite-fill"><ul class="list-btn list-center"><li><a href="#" class="btn-red btn-border btn-premium" ng-click="closeWindow()">{{ 'cancel' | i18n:loc.ale:'common' }}</a></li><li><a href="#" class="btn-orange btn-border" ng-click="submit()">{{ 'add' | i18n:loc.ale:'common' }}</a></li></ul></footer></div>`)
        interfaceOverflow.addStyle('#two-builder-queue tr.reached td{background-color:#b9af7e}#two-builder-queue tr.progress td{background-color:#af9d57}#two-builder-queue .building-sequence,#two-builder-queue .building-sequence-final,#two-builder-queue .building-sequence-editor{margin-bottom:10px}#two-builder-queue .building-sequence td,#two-builder-queue .building-sequence-final td,#two-builder-queue .building-sequence-editor td,#two-builder-queue .building-sequence th,#two-builder-queue .building-sequence-final th,#two-builder-queue .building-sequence-editor th{text-align:center}#two-builder-queue .building-sequence-editor .selected td{background-color:#b9af7e}#two-builder-queue .editor-select-sequence{margin-bottom:13px}#two-builder-queue a.btn{height:28px;line-height:28px;padding:0 10px}#two-builder-queue .clone-sequence{float:left;margin-right:10px}#two-builder-queue .select-sequence-editor{float:left;margin-top:1px;margin-right:10px}#two-builder-queue .remove-sequence{width:28px;height:28px}#add-building-modal td{text-align:center}#add-building-modal .select-wrapper{width:250px}#add-building-modal input[type="text"]{width:60px}')
    }

    var buildWindow = function () {
        $scope = window.$scope = $rootScope.$new()
        $scope.textObject = textObject
        $scope.textObjectCommon = textObjectCommon
        $scope.selectedTab = TAB_TYPES.SETTINGS
        $scope.TAB_TYPES = TAB_TYPES
        $scope.SETTINGS = SETTINGS
        $scope.running = running
        $scope.settings = parseSettings(builderQueue.getSettings())
        $scope.logs = builderQueue.getLogs()

        $scope.pagination = {}

        $scope.editorView = editorView
        $scope.editorView.buildingSequence = {}
        $scope.editorView.visibleBuildingSequence = {}
        $scope.editorView.selectedSequence = angular.copy($scope.settings[SETTINGS.ACTIVE_SEQUENCE])

        $scope.settingsView = settingsView
        $scope.settingsView.buildingSequence = {}
        $scope.settingsView.buildingSequenceFinal = {}

        // methods
        $scope.selectTab = selectTab
        $scope.switchBuilder = switchBuilder
        $scope.clearLogs = clearLogs
        $scope.saveSettings = saveSettings

        eventHandlers.updateGroups()
        eventHandlers.updateSequences()
        
        settingsView.generateBuildingsLevelPoints()
        settingsView.generateBuildingSequence()
        settingsView.generateBuildingSequenceFinal()

        editorView.generateBuildingSequence()

        $scope.pagination.buildingSequence = {
            count: settingsView.buildingSequence.length,
            offset: 0,
            loader: settingsView.updateVisibleBuildingSequence,
            limit: storageService.getPaginationLimit()
        }

        $scope.pagination.buildingSequenceEditor = {
            count: editorView.buildingSequence.length,
            offset: 0,
            loader: editorView.updateVisibleBuildingSequence,
            limit: storageService.getPaginationLimit()
        }

        settingsView.updateVisibleBuildingSequence()
        editorView.updateVisibleBuildingSequence()

        $scope.$watch('settings[SETTINGS.ACTIVE_SEQUENCE].value', eventHandlers.generateBuildingSequences)
        $scope.$watch('editorView.selectedSequence.value', eventHandlers.generateBuildingSequencesEditor)

        eventScope = new EventScope('twoverflow_builder_queue_window')
        eventScope.register(eventTypeProvider.GROUPS_UPDATED, eventHandlers.updateGroups, true)
        eventScope.register(eventTypeProvider.GROUPS_CREATED, eventHandlers.updateGroups, true)
        eventScope.register(eventTypeProvider.GROUPS_DESTROYED, eventHandlers.updateGroups, true)
        eventScope.register(eventTypeProvider.VILLAGE_SELECTED_CHANGED, eventHandlers.generateBuildingSequences, true)
        eventScope.register(eventTypeProvider.BUILDING_UPGRADING, eventHandlers.generateBuildingSequences, true)
        eventScope.register(eventTypeProvider.BUILDING_LEVEL_CHANGED, eventHandlers.generateBuildingSequences, true)
        eventScope.register(eventTypeProvider.BUILDING_TEARING_DOWN, eventHandlers.generateBuildingSequences, true)
        eventScope.register(eventTypeProvider.VILLAGE_BUILDING_QUEUE_CHANGED, eventHandlers.generateBuildingSequences, true)
        eventScope.register(eventTypeProvider.BUILDER_QUEUE_JOB_STARTED, eventHandlers.updateLogs)
        eventScope.register(eventTypeProvider.BUILDER_QUEUE_CLEAR_LOGS, eventHandlers.updateLogs)
        eventScope.register(eventTypeProvider.BUILDER_QUEUE_BUILDING_SEQUENCES_UPDATED, eventHandlers.buildingSequenceUpdate)
        eventScope.register(eventTypeProvider.BUILDER_QUEUE_BUILDING_SEQUENCES_ADDED, eventHandlers.buildingSequenceAdd)
        eventScope.register(eventTypeProvider.BUILDER_QUEUE_BUILDING_SEQUENCES_REMOVED, eventHandlers.buildingSequenceRemoved)
        eventScope.register(eventTypeProvider.BUILDER_QUEUE_SETTINGS_CHANGE, eventHandlers.saveSettings)
        eventScope.register(eventTypeProvider.BUILDER_QUEUE_START, eventHandlers.started)
        eventScope.register(eventTypeProvider.BUILDER_QUEUE_STOP, eventHandlers.stopped)

        windowManagerService.getScreenWithInjectedScope('!twoverflow_builder_queue_window', $scope)
    }

    return init
})

define('two/queue', [
    'two/utils',
    'queues/EventQueue',
    'helper/time',
    'helper/math',
    'struct/MapData',
    'conf/conf',
    'Lockr',
    'two/queue/dateTypes',
    'two/queue/eventCodes',
    'two/queue/filterTypes'
], function (
    utils,
    eventQueue,
    $timeHelper,
    $math,
    $mapData,
    $conf,
    Lockr,
    DATE_TYPES,
    EVENT_CODES,
    FILTER_TYPES
) {
    var CHECKS_PER_SECOND = 10
    var ERROR_CODES = {
        INVALID_ORIGIN: 'invalidOrigin',
        INVALID_TARGET: 'invalidTarget'
    }
    var waitingCommands = []
    var waitingCommandsObject = {}
    var sentCommands = []
    var expiredCommands = []
    var running = false
    var $player
    var commandTypes = ['attack', 'support', 'relocate']
    var timeOffset

    var commandFilters = {
        [FILTER_TYPES.SELECTED_VILLAGE]: function (command) {
            return command.origin.id === modelDataService.getSelectedVillage().getId()
        },
        [FILTER_TYPES.BARBARIAN_TARGET]: function (command) {
            return !command.target.character_id
        },
        [FILTER_TYPES.ALLOWED_TYPES]: function (command, options) {
            return options[FILTER_TYPES.ALLOWED_TYPES][command.type]
        },
        [FILTER_TYPES.ATTACK]: function (command) {
            return command.type !== 'attack'
        },
        [FILTER_TYPES.SUPPORT]: function (command) {
            return command.type !== 'support'
        },
        [FILTER_TYPES.RELOCATE]: function (command) {
            return command.type !== 'relocate'
        },
        [FILTER_TYPES.TEXT_MATCH]: function (command, options) {
            var show = true
            var keywords = options[FILTER_TYPES.TEXT_MATCH].toLowerCase().split(/\W/)

            var searchString = [
                command.origin.name,
                command.origin.x + '|' + command.origin.y,
                command.origin.character_name || '',
                command.target.name,
                command.target.x + '|' + command.target.y,
                command.target.character_name || '',
                command.target.tribe_name || '',
                command.target.tribe_tag || ''
            ]

            searchString = searchString.join('').toLowerCase()

            keywords.some(function (keyword) {
                if (keyword.length && !searchString.includes(keyword)) {
                    show = false
                    return true
                }
            })

            return show
        }
    }

    var isTimeToSend = function (sendTime) {
        return sendTime < ($timeHelper.gameTime() + timeOffset)
    }

    /**
     * Remove os zeros das unidades passadas pelo jogador.
     * A razão de remover é por que o próprio não os envia
     * quando os comandos são enviados manualmente, então
     * caso seja enviado as unidades com valores zero poderia
     * ser uma forma de detectar os comandos automáticos.
     *
     * @param  {Object} units - Unidades a serem analisadas
     * @return {Object} Objeto sem nenhum valor zero
     */
    var cleanZeroUnits = function (units) {
        var cleanUnits = {}

        for (var unit in units) {
            var amount = units[unit]

            if (amount === '*' || amount !== 0) {
                cleanUnits[unit] = amount
            }
        }

        return cleanUnits
    }

    var sortWaitingQueue = function () {
        waitingCommands = waitingCommands.sort(function (a, b) {
            return a.sendTime - b.sendTime
        })
    }

    var pushWaitingCommand = function (command) {
        waitingCommands.push(command)
    }

    var pushCommandObject = function (command) {
        waitingCommandsObject[command.id] = command
    }

    var pushSentCommand = function (command) {
        sentCommands.push(command)
    }

    var pushExpiredCommand = function (command) {
        expiredCommands.push(command)
    }

    var storeWaitingQueue = function () {
        Lockr.set('queue-commands', waitingCommands)
    }

    var storeSentQueue = function () {
        Lockr.set('queue-sent', sentCommands)
    }

    var storeExpiredQueue = function () {
        Lockr.set('queue-expired', expiredCommands)
    }

    var loadStoredCommands = function () {
        var storedQueue = Lockr.get('queue-commands', [], true)

        if (storedQueue.length) {
            for (var i = 0; i < storedQueue.length; i++) {
                var command = storedQueue[i]

                if ($timeHelper.gameTime() > command.sendTime) {
                    commandQueue.expireCommand(command, EVENT_CODES.TIME_LIMIT)
                } else {
                    waitingCommandHelpers(command)
                    pushWaitingCommand(command)
                    pushCommandObject(command)
                }
            }
        }
    }

    var waitingCommandHelpers = function (command) {
        if (command.hasOwnProperty('countdown')) {
            return false
        }

        command.countdown = function () {
            return $timeHelper.readableMilliseconds(Date.now() - command.sendTime)
        }
    }

    var parseDynamicUnits = function (command) {
        var playerVillages = modelDataService.getVillages()
        var village = playerVillages[command.origin.id]

        if (!village) {
            return EVENT_CODES.NOT_OWN_VILLAGE
        }

        var villageUnits = village.unitInfo.units
        var parsedUnits = {}

        for (var unit in command.units) {
            var amount = command.units[unit]

            if (amount === '*') {
                amount = villageUnits[unit].available

                if (amount === 0) {
                    continue
                }
            } else if (amount < 0) {
                amount = villageUnits[unit].available - Math.abs(amount)

                if (amount < 0) {
                    return EVENT_CODES.NOT_ENOUGH_UNITS
                }
            } else if (amount > 0) {
                if (amount > villageUnits[unit].available) {
                    return EVENT_CODES.NOT_ENOUGH_UNITS
                }
            }

            parsedUnits[unit] = amount
        }

        if (angular.equals({}, parsedUnits)) {
            return EVENT_CODES.NOT_ENOUGH_UNITS
        }

        return parsedUnits
    }

    var listenCommands = function () {
        setInterval(function () {
            if (!waitingCommands.length) {
                return
            }

            waitingCommands.some(function (command) {
                if (isTimeToSend(command.sendTime)) {
                    if (running) {
                        commandQueue.sendCommand(command)
                    } else {
                        commandQueue.expireCommand(command, EVENT_CODES.TIME_LIMIT)
                    }
                } else {
                    return true
                }
            })
        }, 1000 / CHECKS_PER_SECOND)
    }

    var commandQueue = {
        initialized: false
    }

    commandQueue.init = function () {
        timeOffset = utils.getTimeOffset()
        $player = modelDataService.getSelectedCharacter()

        commandQueue.initialized = true

        sentCommands = Lockr.get('queue-sent', [], true)
        expiredCommands = Lockr.get('queue-expired', [], true)

        loadStoredCommands()
        listenCommands()

        window.addEventListener('beforeunload', function (event) {
            if (running && waitingCommands.length) {
                event.returnValue = true
            }
        })
    }

    commandQueue.sendCommand = function (command) {
        var units = parseDynamicUnits(command)

        // units === EVENT_CODES.*
        if (typeof units === 'string') {
            return commandQueue.expireCommand(command, units)
        }

        command.units = units

        socketService.emit(routeProvider.SEND_CUSTOM_ARMY, {
            start_village: command.origin.id,
            target_village: command.target.id,
            type: command.type,
            units: command.units,
            icon: 0,
            officers: command.officers,
            catapult_target: command.catapultTarget
        })

        pushSentCommand(command)
        storeSentQueue()

        commandQueue.removeCommand(command, EVENT_CODES.COMMAND_SENT)
        eventQueue.trigger(eventTypeProvider.COMMAND_QUEUE_SEND, command)
    }

    commandQueue.expireCommand = function (command, eventCode) {
        pushExpiredCommand(command)
        storeExpiredQueue()

        commandQueue.removeCommand(command, eventCode)
    }

    /**
     * UPDATE THIS SHIT BELOW
     *
     * @param {Object} command
     * @param {String} command.origin - Coordenadas da aldeia de origem.
     * @param {String} command.target - Coordenadas da aldeia alvo.
     * @param {String} command.date - Data e hora que o comando deve chegar.
     * @param {String} command.dateType - Indica se o comando vai sair ou
     *   chegar na data especificada.
     * @param {Object} command.units - Unidades que serão enviados pelo comando.
     * @param {Object} command.officers - Oficiais que serão enviados pelo comando.
     * @param {String} command.type - Tipo de comando.
     * @param {String=} command.catapultTarget - Alvo da catapulta, caso o comando seja um ataque.
     */
    commandQueue.addCommand = function (command) {
        if (!command.origin) {
            return eventQueue.trigger(eventTypeProvider.COMMAND_QUEUE_ADD_INVALID_ORIGIN, command)
        }

        if (!command.target) {
            return eventQueue.trigger(eventTypeProvider.COMMAND_QUEUE_ADD_INVALID_TARGET, command)
        }

        if (!utils.isValidDateTime(command.date)) {
            return eventQueue.trigger(eventTypeProvider.COMMAND_QUEUE_ADD_INVALID_DATE, command)
        }

        if (!command.units || angular.equals(command.units, {})) {
            return eventQueue.trigger(eventTypeProvider.COMMAND_QUEUE_ADD_NO_UNITS, command)
        }

        var getOriginVillage = new Promise(function (resolve, reject) {
            commandQueue.getVillageByCoords(command.origin.x, command.origin.y, function (data) {
                data ? resolve(data) : reject(ERROR_CODES.INVALID_ORIGIN)
            })
        })

        var getTargetVillage = new Promise(function (resolve, reject) {
            commandQueue.getVillageByCoords(command.target.x, command.target.y, function (data) {
                data ? resolve(data) : reject(ERROR_CODES.INVALID_TARGET)
            })
        })

        var loadVillagesData = Promise.all([
            getOriginVillage,
            getTargetVillage
        ])

        for (var officer in command.officers) {
            if (command.officers[officer]) {
                command.officers[officer] = 1
            } else {
                delete command.officers[officer]
            }
        }

        loadVillagesData.then(function (villages) {
            command.origin = villages[0]
            command.target = villages[1]
            command.units = cleanZeroUnits(command.units)
            command.date = utils.fixDate(command.date)
            command.travelTime = commandQueue.getTravelTime(
                command.origin,
                command.target,
                command.units,
                command.type,
                command.officers
            )

            var inputTime = utils.getTimeFromString(command.date)

            if (command.dateType === 'arrive') {
                command.sendTime = inputTime - command.travelTime
                command.arriveTime = inputTime
            } else {
                command.sendTime = inputTime
                command.arriveTime = inputTime + command.travelTime
            }

            if (isTimeToSend(command.sendTime)) {
                return eventQueue.trigger(eventTypeProvider.COMMAND_QUEUE_ADD_ALREADY_SENT, command)
            }

            if (command.type === 'attack' && 'supporter' in command.officers) {
                delete command.officers.supporter
            }


            if (command.type === 'attack' && command.units.catapult) {
                command.catapultTarget = command.catapultTarget || 'headquarter'
            } else {
                command.catapultTarget = null
            }

            command.id = utils.guid()

            waitingCommandHelpers(command)
            pushWaitingCommand(command)
            pushCommandObject(command)
            sortWaitingQueue()
            storeWaitingQueue()

            eventQueue.trigger(eventTypeProvider.COMMAND_QUEUE_ADD, command)
        })

        loadVillagesData.catch(function (errorCode) {
            switch (errorCode) {
            case ERROR_CODES.INVALID_ORIGIN:
                eventQueue.trigger(eventTypeProvider.COMMAND_QUEUE_ADD_INVALID_ORIGIN, command)
                break
            case ERROR_CODES.INVALID_TARGET:
                eventQueue.trigger(eventTypeProvider.COMMAND_QUEUE_ADD_INVALID_TARGET, command)
                break
            }
        })
    }

    /**
     * @param  {Object} command - Dados do comando a ser removido.
     * @param {Number} eventCode - Code indicating the reason of the remotion.
     *
     * @return {Boolean} If the command was successfully removed.
     */
    commandQueue.removeCommand = function (command, eventCode) {
        var removed = false
        delete waitingCommandsObject[command.id]

        for (var i = 0; i < waitingCommands.length; i++) {
            if (waitingCommands[i].id == command.id) {
                waitingCommands.splice(i, 1)
                storeWaitingQueue()
                removed = true

                break
            }
        }

        if (removed) {
            switch (eventCode) {
            case EVENT_CODES.TIME_LIMIT:
                eventQueue.trigger(eventTypeProvider.COMMAND_QUEUE_SEND_TIME_LIMIT, command)
                break
            case EVENT_CODES.NOT_OWN_VILLAGE:
                eventQueue.trigger(eventTypeProvider.COMMAND_QUEUE_SEND_NOT_OWN_VILLAGE, command)
                break
            case EVENT_CODES.NOT_ENOUGH_UNITS:
                eventQueue.trigger(eventTypeProvider.COMMAND_QUEUE_SEND_NO_UNITS_ENOUGH, command)
                break
            case EVENT_CODES.COMMAND_REMOVED:
                eventQueue.trigger(eventTypeProvider.COMMAND_QUEUE_REMOVE, command)
                break
            }

            return true
        } else {
            eventQueue.trigger(eventTypeProvider.COMMAND_QUEUE_REMOVE_ERROR, command)
            return false
        }
    }

    commandQueue.clearRegisters = function () {
        Lockr.set('queue-expired', [])
        Lockr.set('queue-sent', [])
        expiredCommands = []
        sentCommands = []
    }

    commandQueue.start = function (disableNotif) {
        running = true
        eventQueue.trigger(eventTypeProvider.COMMAND_QUEUE_START, {
            disableNotif: !!disableNotif
        })
    }

    commandQueue.stop = function () {
        running = false
        eventQueue.trigger(eventTypeProvider.COMMAND_QUEUE_STOP)
    }

    commandQueue.isRunning = function () {
        return running
    }

    commandQueue.getWaitingCommands = function () {
        return waitingCommands
    }

    commandQueue.getWaitingCommandsObject = function () {
        return waitingCommandsObject
    }

    commandQueue.getSentCommands = function () {
        return sentCommands
    }

    commandQueue.getExpiredCommands = function () {
        return expiredCommands
    }

    /**
     * @param {Object} origin - Objeto da aldeia origem.
     * @param {Object} target - Objeto da aldeia alvo.
     * @param {Object} units - Exercito usado no ataque como referência
     * para calcular o tempo.
     * @param {String} type - Tipo de comando (attack,support,relocate)
     * @param {Object} officers - Oficiais usados no comando (usados para efeitos)
     *
     * @return {Number} Tempo de viagem
     */
    commandQueue.getTravelTime = function (origin, target, units, type, officers) {
        var useEffects = false
        var targetIsBarbarian = target.character_id === null
        var targetIsSameTribe = target.character_id && target.tribe_id &&
            target.tribe_id === $player.getTribeId()

        if (type === 'attack') {
            if ('supporter' in officers) {
                delete officers.supporter
            }

            if (targetIsBarbarian) {
                useEffects = true
            }
        } else if (type === 'support') {
            if (targetIsSameTribe) {
                useEffects = true
            }

            if ('supporter' in officers) {
                useEffects = true
            }
        }

        var army = {
            units: units,
            officers: angular.copy(officers)
        }

        var travelTime = armyService.calculateTravelTime(army, {
            barbarian: targetIsBarbarian,
            ownTribe: targetIsSameTribe,
            officers: officers,
            effects: useEffects
        }, type)

        var distance = $math.actualDistance(origin, target)

        var totalTravelTime = armyService.getTravelTimeForDistance(
            army,
            travelTime,
            distance,
            type
        )

        return totalTravelTime * 1000
    }

    commandQueue.getVillageByCoords = function (x, y, callback) {
        $mapData.loadTownDataAsync(x, y, 1, 1, callback)
    }

    /**
     * @param  {String} filterId - Identificação do filtro.
     * @param {Array=} _options - Valores a serem passados para os filtros.
     * @param {Array=} _commandsDeepFilter - Usa os comandos passados
     * pelo parâmetro ao invés da lista de comandos completa.
     * @return {Array} Comandos filtrados.
     */
    commandQueue.filterCommands = function (filterId, _options, _commandsDeepFilter) {
        var filterHandler = commandFilters[filterId]
        var commands = _commandsDeepFilter || waitingCommands

        return commands.filter(function (command) {
            return filterHandler(command, _options)
        })
    }

    return commandQueue
})

define('two/queue/dateTypes', [], function () {
    return {
        ARRIVE: 'arrive',
        OUT: 'out'
    }
})

define('two/queue/eventCodes', [], function () {
    return {
        NOT_OWN_VILLAGE: 'not_own_village',
        NOT_ENOUGH_UNITS: 'not_enough_units',
        TIME_LIMIT: 'time_limit',
        COMMAND_REMOVED: 'command_removed',
        COMMAND_SENT: 'command_sent'
    }
})

define('two/queue/Events', [], function () {
    angular.extend(eventTypeProvider, {
        COMMAND_QUEUE_SEND: 'commandqueue_send',
        COMMAND_QUEUE_SEND_TIME_LIMIT: 'commandqueue_send_time_limit',
        COMMAND_QUEUE_SEND_NOT_OWN_VILLAGE: 'commandqueue_send_not_own_village',
        COMMAND_QUEUE_SEND_NO_UNITS_ENOUGH: 'commandqueue_send_no_units_enough',
        COMMAND_QUEUE_ADD: 'commandqueue_add',
        COMMAND_QUEUE_ADD_INVALID_ORIGIN: 'commandqueue_add_invalid_origin',
        COMMAND_QUEUE_ADD_INVALID_TARGET: 'commandqueue_add_invalid_target',
        COMMAND_QUEUE_ADD_INVALID_DATE: 'commandqueue_add_invalid_date',
        COMMAND_QUEUE_ADD_NO_UNITS: 'commandqueue_add_no_units',
        COMMAND_QUEUE_ADD_ALREADY_SENT: 'commandqueue_add_already_sent',
        COMMAND_QUEUE_ADD_INVALID_ORIGIN: 'commandqueue_add_invalid_origin',
        COMMAND_QUEUE_ADD_INVALID_TARGET: 'commandqueue_add_invalid_target',
        COMMAND_QUEUE_REMOVE: 'commandqueue_remove',
        COMMAND_QUEUE_REMOVE_ERROR: 'commandqueue_remove_error',
        COMMAND_QUEUE_START: 'commandqueue_start',
        COMMAND_QUEUE_STOP: 'commandqueue_stop'
    })
})

define('two/queue/filterTypes', [], function () {
    return {
        SELECTED_VILLAGE: 'selected_village',
        BARBARIAN_TARGET: 'barbarian_target',
        ALLOWED_TYPES: 'allowed_types',
        ATTACK: 'attack',
        SUPPORT: 'support',
        RELOCATE: 'relocate',
        TEXT_MATCH: 'text_match'
    }
})

require([
    'helper/i18n',
    'two/ready',
    'two/queue',
    'two/queue/ui',
    'two/queue/Events'
], function (
    i18n,
    ready,
    commandQueue,
    commandQueueInterface
) {
    if (commandQueue.initialized) {
        return false
    }

    var updateModuleLang = function () {
        var langs = {"en_us":{"queue":{"title":"CommandQueue","attack":"Attack","support":"Support","relocate":"Transfer","sent":"sent","activated":"enabled","deactivated":"disabled","expired":"expired","removed":"removed","added":"added","general_clear":"Clear logs","general_next_command":"Next command","add_basics":"Basic information","add_origin":"Origin","add_selected":"Active village","add_target":"Target","add_map_selected":"Selected village on a map","add_arrive":"Command arrive at date","add_out":"Command leave at date","add_current_date":"Current date","add_current_date_plus":"Increase date in 100 milliseconds.","add_current_date_minus":"Reduce date in 100 milliseconds.","add_travel_times":"Unit travel time","add_date":"Date/time","add_no_village":"select a village...","add_village_search":"Village search...","add_clear":"Clear fields","add_insert_preset":"Insert preset","queue_waiting":"Waiting commands","queue_none_added":"No command added.","queue_sent":"Commands sent","queue_none_sent":"No command sent.","queue_expired":"Expired commands","queue_none_expired":"No command expired.","queue_remove":"Remove command form list","queue_filters":"Filter commands","filters_selected_village":"Show only commands from the selected village","filters_barbarian_target":"Show only commands with barbarian villages as target","filters_attack":"Show attacks","filters_support":"Show supports","filters_relocate":"Show transfers","filters_text_match":"Filter by text...","command_out":"Out","command_time_left":"Time remaining","command_arrive":"Arrival","error_no_units_enough":"No units enough to send the command!","error_not_own_village":"The origin village is not owned by you!","error_origin":"Invalid origin village!","error_target":"Invalid target village!","error_no_units":"No units specified!","error_invalid_date":"Invalid date","error_already_sent":"This %{type} should have left %{date}","error_no_map_selected_village":"No selected village on map.","error_remove_error":"Error removing command.","tab_add":"Add command","tab_waiting":"Queued commands","tab_logs":"Command logs"}},"pl_pl":{"queue":{"title":"Generał","attack":"Atak","support":"Wsparcie","relocate":"przenieś","sent":"wysłany/e","activated":"włączony","deactivated":"wyłączony","expired":"przedawniony/e","removed":"usunięty/e","added":"dodany/e","general_clear":"Wyczyść logi","general_next_command":"Następny rozkaz","add_basics":"Podstawowe informacje","add_origin":"Źródło","add_selected":"Aktywna wioska","add_target":"Cel","add_map_selected":"Wybrana wioska na mapie","add_arrive":"Czas dotarcia na cel","add_out":"Czas wyjścia z  twojej wioski","add_current_date":"Obecny czas","add_current_date_plus":"Zwiększ czas o 100 milisekund.","add_current_date_minus":"Zmniejsz czas o 100 milisekund.","add_travel_times":"Czas podróży jendostek","add_date":"Czas/Data","add_no_village":"Wybierz wioskę...","add_village_search":"Znajdź wioskę...","add_clear":"wyczyść","add_insert_preset":"Insert preset","queue_waiting":"Rozkazy","queue_none_added":"Brak dodanych rozkazów.","queue_sent":"Rozkazy wysłane","queue_none_sent":"Brak wysłanych rozkazów.","queue_expired":"Przedawnione rozkazy","queue_none_expired":"Brak przedawnionych rozkazów.","queue_remove":"Usuń rozkaz z listy","queue_filters":"Filtruj rozkazy","filters_selected_village":"Pokaż tylko rozkazy z aktywnej wioski","filters_barbarian_target":"Pokaż tylko rozkazy na wioski barbarzyńskie","filters_attack":"Pokaż ataki","filters_support":"Pokaż wsparcia","filters_relocate":"Pokaż przeniesienia","filters_text_match":"Filtruj za pomocą tekstu...","command_out":"Czas wyjścia","command_time_left":"Pozostały czas","command_arrive":"Czas dotarcia","error_no_units_enough":"Brak wystarczającej liczby jednostek do wysłania rozkazu!","error_not_own_village":"Wioska źródłowa nie należy do ciebie!","error_origin":"Nieprawidłowa wioska źródłowa!","error_target":"Nieprawidłowa wioska cel!","error_no_units":"Nie wybrano jednostek!","error_invalid_date":"Nieprawidłowy Czas","error_already_sent":"Ten rozkaz %{type} powinien zostać wysłany %{date}","error_no_map_selected_village":"Nie zaznaczono wioski na mapie.","error_remove_error":"Błąd usuwania rozkazu.","tab_add":"Add command","tab_waiting":"Queued commands","tab_logs":"Command logs"}},"pt_br":{"queue":{"title":"CommandQueue","attack":"Ataque","support":"Apoio","relocate":"Transferência","sent":"enviado","activated":"ativado","deactivated":"desativado","expired":"expirado","removed":"removido","added":"adicionado","general_clear":"Limpar registros","general_next_command":"Próximo comando","add_basics":"Informações básicas","add_origin":"Aldeia de origem","add_selected":"Selecionar aldeia ativa","add_target":"Aldea alvo","add_map_selected":"Selecionar aldeia selecionada no mapa","add_arrive":"Data de chegada","add_out":"Data de saída","add_current_date":"Data/hora","add_current_date_plus":"Aumentar data em 100 milisegunds.","add_current_date_minus":"Reduzir data em 100 milisegunds.","add_travel_times":"Tempos de viagem","add_date":"Data","add_no_village":"selecione uma aldeia...","add_village_search":"Procurar aldeia...","add_clear":"Limpar campos","add_insert_preset":"Inserir predefinição","queue_waiting":"Comandos em espera","queue_none_added":"Nenhum comando adicionado.","queue_sent":"Comandos enviados","queue_none_sent":"Nenhum comando enviado.","queue_expired":"Comandos expirados","queue_none_expired":"Nenhum comando expirado.","queue_remove":"Remover comando da lista","queue_filters":"Filtro de comandos","filters_selected_village":"Mostrar apenas comandos com origem da aldeia selecionada","filters_barbarian_target":"Mostrar apenas comandos com aldeias bárbaras como alvo","filters_attack":"Mostrar ataques","filters_support":"Mostrar apoios","filters_relocate":"Mostrar transferências","filters_text_match":"Filtrar por texto...","command_out":"Saída na data","command_time_left":"Tempo restante","command_arrive":"Chegada na data","error_no_units_enough":"Sem unidades o sulficientes para enviar o comando!","error_not_own_village":"A aldeia de origem não pertence a você!","error_origin":"Aldeia de origem inválida!","error_target":"Aldeia alvo inválida!","error_no_units":"Nenhuma unidade especificada!","error_invalid_date":"Data inválida","error_already_sent":"Esse %d deveria ter saído %d","error_no_map_selected_village":"Nenhuma aldeia selecionada no mapa.","error_remove_error":"Erro ao remover comando.","tab_add":"Adicionar comando","tab_waiting":"Comandos em espera","tab_logs":"Registro de comandos"}}}
        var current = $rootScope.loc.ale
        var data = current in langs
            ? langs[current]
            : langs['en_us']

        i18n.setJSON(data)
    }

    ready(function () {
        updateModuleLang()

        commandQueue.init()
        commandQueueInterface()

        if (commandQueue.getWaitingCommands().length > 0) {
            commandQueue.start(true)
        }
    })
})

define('two/queue/ui', [
    'two/queue',
    'two/ui2',
    'two/FrontButton',
    'two/utils',
    'queues/EventQueue',
    'helper/time',
    'helper/util',
    'two/utils',
    'two/EventScope',
    'two/ui/autoComplete',
    'two/queue/dateTypes',
    'two/queue/eventCodes',
    'two/queue/filterTypes'
], function (
    commandQueue,
    interfaceOverflow,
    FrontButton,
    utils,
    eventQueue,
    $timeHelper,
    util,
    utils,
    EventScope,
    autoComplete,
    DATE_TYPES,
    EVENT_CODES,
    FILTER_TYPES
) {
    var textObject = 'queue'
    var textObjectCommon = 'common'
    var eventScope
    var $scope
    var $gameData = modelDataService.getGameData()
    var orderedUnitNames = $gameData.getOrderedUnitNames()
    var orderedOfficerNames = $gameData.getOrderedOfficerNames()
    var presetList = modelDataService.getPresetList()
    var mapSelectedVillage = false
    var unitOrder
    var commandData
    var COMMAND_TYPES = ['attack', 'support', 'relocate']
    var TAB_TYPES = {
        ADD: 'add',
        WAITING: 'waiting',
        LOGS: 'logs'
    }
    var DEFAULT_TAB = TAB_TYPES.ADD
    var DEFAULT_CATAPULT_TARGET = 'wall'
    var attackableBuildingsList = []
    var unitList = {}
    var officerList = {}
    var timeOffset
    var activeFilters
    var filtersData
    /**
     * Name of one unity for each speed category.
     * Used to generate travel times.
     */
    var UNITS_BY_SPEED = [
        'light_cavalry',
        'heavy_cavalry',
        'archer',
        'sword',
        'ram',
        'snob',
        'trebuchet'
    ]
    var FILTER_ORDER = [
        FILTER_TYPES.SELECTED_VILLAGE,
        FILTER_TYPES.BARBARIAN_TARGET,
        FILTER_TYPES.ALLOWED_TYPES,
        FILTER_TYPES.TEXT_MATCH
    ]

    var setMapSelectedVillage = function (event, menu) {
        mapSelectedVillage = menu.data
    }

    var unsetMapSelectedVillage = function () {
        mapSelectedVillage = false
    }

    /**
     * @param {Number=} _ms - Optional time to be formated instead of the game date.
     * @return {String}
     */
    var formatedDate = function (_ms) {
        var date = new Date(_ms || ($timeHelper.gameTime() + utils.getTimeOffset()))

        var rawMS = date.getMilliseconds()
        var ms = $timeHelper.zerofill(rawMS - (rawMS % 100), 3)
        var sec = $timeHelper.zerofill(date.getSeconds(), 2)
        var min = $timeHelper.zerofill(date.getMinutes(), 2)
        var hour = $timeHelper.zerofill(date.getHours(), 2)
        var day = $timeHelper.zerofill(date.getDate(), 2)
        var month = $timeHelper.zerofill(date.getMonth() + 1, 2)
        var year = date.getFullYear()

        return hour + ':' + min + ':' + sec + ':' + ms + ' ' + day + '/' + month + '/' + year
    }

    var addDateDiff = function (date, diff) {
        if (!utils.isValidDateTime(date)) {
            return ''
        }

        date = utils.fixDate(date)
        date = utils.getTimeFromString(date)
        date += diff

        return formatedDate(date)
    }

    var updateTravelTimes = function () {
        $scope.isValidDate = utils.isValidDateTime(commandData.date)

        if (!commandData.origin || !commandData.target) {
            return false
        }

        var date
        var arriveTime
        var travelTime
        var sendTime
        var valueType

        COMMAND_TYPES.forEach(function (commandType) {
            $scope.travelTimes[commandType] = {}

            UNITS_BY_SPEED.forEach(function (unit) {
                travelTime = commandQueue.getTravelTime(
                    commandData.origin,
                    commandData.target,
                    {[unit]: 1},
                    commandType,
                    commandData.officers
                )

                if ($scope.selectedDateType.value === DATE_TYPES.OUT) {
                    if ($scope.isValidDate) {
                        date = utils.fixDate(commandData.date)
                        outTime = utils.getTimeFromString(date)
                        valueType = isValidSendTime(outTime) ? 'valid' : 'invalid'
                    } else {
                        valueType = 'neutral'
                    }
                } else if ($scope.selectedDateType.value === DATE_TYPES.ARRIVE) {
                    if ($scope.isValidDate) {
                        date = utils.fixDate(commandData.date)
                        arriveTime = utils.getTimeFromString(date)
                        sendTime = arriveTime - travelTime
                        valueType = isValidSendTime(sendTime) ? 'valid' : 'invalid'
                    } else {
                        valueType = 'invalid'
                    }
                }

                $scope.travelTimes[commandType][unit] = {
                    value: $filter('readableMillisecondsFilter')(travelTime),
                    valueType: valueType
                }
            })
        })
    }

    /**
     * @param  {Number}  time - Command date input in milliseconds.
     * @return {Boolean}
     */
    var isValidSendTime = function (time) {
        if (!$scope.isValidDate) {
            return false
        }

        return ($timeHelper.gameTime() + timeOffset) < time
    }

    var updateDateType = function () {
        commandData.dateType = $scope.selectedDateType.value
        updateTravelTimes()
    }

    var insertPreset = function () {
        var selectedPreset = $scope.selectedInsertPreset.value

        if (!selectedPreset) {
            return false
        }

        var presets = modelDataService.getPresetList().getPresets()
        var preset = presets[selectedPreset]

        // reset displayed value
        $scope.selectedInsertPreset = {
            name: $filter('i18n')('add_insert_preset', $rootScope.loc.ale, textObject),
            value: null
        }

        commandData.units = angular.copy(preset.units)
        commandData.officers = angular.copy(preset.officers)

        if (preset.catapult_target) {
            commandData.catapultTarget = preset.catapult_target
            $scope.catapultTarget = {
                name: $filter('i18n')(preset.catapult_target, $rootScope.loc.ale, 'building_names'),
                value: preset.catapult_target
            }
            $scope.showCatapultSelect = true

        }
    }

    var updateWaitingCommands = function () {
        $scope.waitingCommands = commandQueue.getWaitingCommands()
    }

    var updateSentCommands = function () {
        $scope.sentCommands = commandQueue.getSentCommands()
    }

    var updateExpiredCommands = function () {
        $scope.expiredCommands = commandQueue.getExpiredCommands()
    }

    var updateVisibleCommands = function () {
        var commands = $scope.waitingCommands

        FILTER_ORDER.forEach(function (filter) {
            if ($scope.activeFilters[filter]) {
                commands = commandQueue.filterCommands(filter, $scope.filtersData, commands)
            }
        })

        $scope.visibleWaitingCommands = commands
    }

    var onUnitInputFocus = function (unit) {
        if (commandData.units[unit] === 0) {
            commandData.units[unit] = ''
        }
    }

    var onUnitInputBlur = function (unit) {
        if (commandData.units[unit] === '') {
            commandData.units[unit] = 0
        }
    }

    var catapultTargetVisibility = function () {
        $scope.showCatapultSelect = !!commandData.units.catapult
    }

    var selectTab = function (tabType) {
        $scope.selectedTab = tabType
    }

    var addSelected = function () {
        var village = modelDataService.getSelectedVillage().data
        
        commandData.origin = {
            id: village.villageId,
            x: village.x,
            y: village.y,
            name: village.name
        }
    }

    var addMapSelected = function () {
        if (!mapSelectedVillage) {
            return utils.emitNotif('error', $filter('i18n')('error_no_map_selected_village', $rootScope.loc.ale, textObject))
        }

        commandQueue.getVillageByCoords(mapSelectedVillage.x, mapSelectedVillage.y, function (data) {
            commandData.target = {
                id: data.id,
                x: data.x,
                y: data.y,
                name: data.name
            }
        })
    }

    var addCurrentDate = function () {
        commandData.date = formatedDate()
    }

    var incrementDate = function () {
        if (!commandData.date) {
            return false
        }

        commandData.date = addDateDiff(commandData.date, 100)
    }

    var reduceDate = function () {
        if (!commandData.date) {
            return false
        }

        commandData.date = addDateDiff(commandData.date, -100)
    }

    var cleanUnitInputs = function () {
        commandData.units = angular.copy(unitList)
        commandData.officers = angular.copy(officerList)
        commandData.catapultTarget = DEFAULT_CATAPULT_TARGET
        $scope.catapultTarget = {
            name: $filter('i18n')(DEFAULT_CATAPULT_TARGET, $rootScope.loc.ale, 'building_names'),
            value: DEFAULT_CATAPULT_TARGET
        }
        $scope.showCatapultSelect = false
    }

    var searchVillage = function (type) {
        var $elem
        var model
        var type

        switch (type) {
        case 'origin':
            $elem = document.querySelector('#two-commandqueue .village-origin')

            break
        case 'target':
            $elem = document.querySelector('#two-commandqueue .village-target')

            break
        default:
            return false
            break
        }

        if ($scope.searchQuery[type].length < 2) {
            return autoComplete.hide()
        }

        autoComplete.search($scope.searchQuery[type], function (data) {
            if (data.length) {
                autoComplete.show(data, $elem, 'commandqueue_village_search', type)
            }
        }, ['village'])
    }

    var addCommand = function (type) {
        var copy = angular.copy(commandData)
        copy.type = type

        commandQueue.addCommand(copy)
    }

    var clearRegisters = function () {
        commandQueue.clearRegisters()
        updateSentCommands()
        updateExpiredCommands()
    }

    var switchCommandQueue = function () {
        if (commandQueue.isRunning()) {
            commandQueue.stop()
        } else {
            commandQueue.start()
        }
    }

    /**
     * Gera um texto de notificação com as traduções.
     *
     * @param  {String} key
     * @param  {String} key2
     * @param  {String=} prefix
     * @return {String}
     */
    var genNotifText = function (key, key2, prefix) {
        if (prefix) {
            key = prefix + '.' + key
        }

        var a = $filter('i18n')(key, $rootScope.loc.ale, textObject)
        var b = $filter('i18n')(key2, $rootScope.loc.ale, textObject)

        return a + ' ' + b
    }

    var toggleFilter = function (filter, allowedTypes) {
        $scope.activeFilters[filter] = !$scope.activeFilters[filter]

        if (allowedTypes) {
            $scope.filtersData[FILTER_TYPES.ALLOWED_TYPES][filter] = !$scope.filtersData[FILTER_TYPES.ALLOWED_TYPES][filter]
        }

        updateVisibleCommands()
    }

    var textMatchFilter = function () {
        $scope.activeFilters[FILTER_TYPES.TEXT_MATCH] = $scope.filtersData[FILTER_TYPES.TEXT_MATCH].length > 0
        updateVisibleCommands()
    }

    var eventHandlers = {
        updatePresets: function () {
            $scope.presets = utils.obj2selectOptions(presetList.getPresets())
        },
        autoCompleteSelected: function (event, id, data, type) {
            if (id !== 'commandqueue_village_search') {
                return false
            }

            commandData[type] = {
                id: data.raw.id,
                x: data.raw.x,
                y: data.raw.y,
                name: data.raw.name
            }

            $scope.searchQuery[type] = ''
        },
        addInvalidOrigin: function (event) {
            utils.emitNotif('error', $filter('i18n')('error_origin', $rootScope.loc.ale, textObject))
        },
        addInvalidTarget: function (event) {
            utils.emitNotif('error', $filter('i18n')('error_target', $rootScope.loc.ale, textObject))
        },
        addInvalidDate: function (event) {
            utils.emitNotif('error', $filter('i18n')('error_invalid_date', $rootScope.loc.ale, textObject))
        },
        addNoUnits: function (event) {
            utils.emitNotif('error', $filter('i18n')('error_no_units', $rootScope.loc.ale, textObject))
        },
        addAlreadySent: function (event, command) {
            var commandType = $filter('i18n')(command.type, $rootScope.loc.ale, textObjectCommon)
            var date = utils.formatDate(command.sendTime)

            utils.emitNotif('error', $filter('i18n')('error_already_sent', $rootScope.loc.ale, textObject, commandType, date))
        },
        removeCommand: function (event, command) {
            updateWaitingCommands()
            updateVisibleCommands()
            $rootScope.$broadcast(eventTypeProvider.TOOLTIP_HIDE, 'twoverflow-tooltip')
            utils.emitNotif('success', genNotifText(command.type, 'removed'))
        },
        removeError: function (event, command) {
            utils.emitNotif('error', $filter('i18n')('error_remove_error', $rootScope.loc.ale, textObject))
        },
        sendTimeLimit: function (event, command) {
            updateSentCommands()
            updateExpiredCommands()
            updateWaitingCommands()
            updateVisibleCommands()
            utils.emitNotif('error', genNotifText(command.type, 'expired'))
        },
        sendNotOwnVillage: function (event, command) {
            updateSentCommands()
            updateExpiredCommands()
            updateWaitingCommands()
            updateVisibleCommands()
            utils.emitNotif('error', $filter('i18n')('error_not_own_village', $rootScope.loc.ale, textObject))
        },
        sendNoUnitsEnough: function (event, command) {
            updateSentCommands()
            updateExpiredCommands()
            updateWaitingCommands()
            updateVisibleCommands()
            utils.emitNotif('error', $filter('i18n')('error_no_units_enough', $rootScope.loc.ale, textObject))
        },
        addCommand: function (event, command) {
            updateWaitingCommands()
            updateVisibleCommands()
            utils.emitNotif('success', genNotifText(command.type, 'added'))
        },
        sendCommand: function (event, command) {
            updateSentCommands()
            updateWaitingCommands()
            updateVisibleCommands()
            utils.emitNotif('success', genNotifText(command.type, 'sent'))
        },
        start: function (event, data) {
            $scope.running = commandQueue.isRunning()

            if (data.disableNotif) {
                return false
            }

            utils.emitNotif('success', genNotifText('title', 'activated'))
        },
        stop: function (event) {
            $scope.running = commandQueue.isRunning()
            utils.emitNotif('success', genNotifText('title', 'deactivated'))
        }
    }

    var init = function () {
        timeOffset = utils.getTimeOffset()
        var attackableBuildingsMap = $gameData.getAttackableBuildings()
        var building

        for (building in attackableBuildingsMap) {
            attackableBuildingsList.push({
                name: $filter('i18n')(building, $rootScope.loc.ale, 'building_names'),
                value: building
            })
        }

        unitOrder = angular.copy(orderedUnitNames)
        unitOrder.splice(unitOrder.indexOf('catapult'), 1)

        orderedUnitNames.forEach(function (unit) {
            unitList[unit] = 0
        })

        orderedOfficerNames.forEach(function (unit) {
            officerList[unit] = false
        })

        commandData = {
            origin: false,
            target: false,
            date: '',
            dateType: DATE_TYPES.OUT,
            units: angular.copy(unitList),
            officers: angular.copy(officerList),
            catapultTarget: DEFAULT_CATAPULT_TARGET,
            type: null
        }
        activeFilters = {
            [FILTER_TYPES.SELECTED_VILLAGE]: false,
            [FILTER_TYPES.BARBARIAN_TARGET]: false,
            [FILTER_TYPES.ALLOWED_TYPES]: true,
            [FILTER_TYPES.ATTACK]: true,
            [FILTER_TYPES.SUPPORT]: true,
            [FILTER_TYPES.RELOCATE]: true,
            [FILTER_TYPES.TEXT_MATCH]: false
        }
        filtersData = {
            [FILTER_TYPES.ALLOWED_TYPES]: {
                [FILTER_TYPES.ATTACK]: true,
                [FILTER_TYPES.SUPPORT]: true,
                [FILTER_TYPES.RELOCATE]: true,
            },
            [FILTER_TYPES.TEXT_MATCH]: ''
        }

        opener = new FrontButton('Commander', {
            classHover: false,
            classBlur: false,
            onClick: buildWindow
        })

        eventQueue.register(eventTypeProvider.COMMAND_QUEUE_START, function () {
            opener.$elem.classList.remove('btn-green')
            opener.$elem.classList.add('btn-red')
        })

        eventQueue.register(eventTypeProvider.COMMAND_QUEUE_STOP, function () {
            opener.$elem.classList.remove('btn-red')
            opener.$elem.classList.add('btn-green')
        })

        $rootScope.$on(eventTypeProvider.SHOW_CONTEXT_MENU, setMapSelectedVillage)
        $rootScope.$on(eventTypeProvider.DESTROY_CONTEXT_MENU, unsetMapSelectedVillage)

        interfaceOverflow.addTemplate('twoverflow_queue_window', `<div id="two-commandqueue" class="win-content two-window"><header class="win-head"><h2>CommandQueue</h2><ul class="list-btn"><li><a href="#" class="size-34x34 btn-red icon-26x26-close" ng-click="closeWindow()"></a></li></ul></header><div class="win-main small-select" scrollbar=""><div class="tabs tabs-bg"><div class="tabs-three-col"><div class="tab" ng-click="selectTab(TAB_TYPES.ADD)" ng-class="{true:'tab-active', false:''}[selectedTab == TAB_TYPES.ADD]"><div class="tab-inner"><div ng-class="{'box-border-light': selectedTab === TAB_TYPES.ADD}"><a href="#" ng-class="{'btn-icon btn-orange': selectedTab !== TAB_TYPES.ADD}">{{ 'tab_add' | i18n:loc.ale:textObject }}</a></div></div></div><div class="tab" ng-click="selectTab(TAB_TYPES.WAITING)" ng-class="{true:'tab-active', false:''}[selectedTab == TAB_TYPES.WAITING]"><div class="tab-inner"><div ng-class="{'box-border-light': selectedTab === TAB_TYPES.WAITING}"><a href="#" ng-class="{'btn-icon btn-orange': selectedTab !== TAB_TYPES.WAITING}">{{ 'tab_waiting' | i18n:loc.ale:textObject }}</a></div></div></div><div class="tab" ng-click="selectTab(TAB_TYPES.LOGS)" ng-class="{true:'tab-active', false:''}[selectedTab == TAB_TYPES.LOGS]"><div class="tab-inner"><div ng-class="{'box-border-light': selectedTab === TAB_TYPES.LOGS}"><a href="#" ng-class="{'btn-icon btn-orange': selectedTab !== TAB_TYPES.LOGS}">{{ 'tab_logs' | i18n:loc.ale:textObject }}</a></div></div></div></div></div><div class="box-paper footer"><div class="scroll-wrap"><div class="add" ng-show="selectedTab === TAB_TYPES.ADD"><form class="addForm"><div><table class="tbl-border-light tbl-striped"><colgroup><col width="30%"><col width="5%"><col><col width="18%"></colgroup><tbody><tr><td><input type="text" ng-model="searchQuery.origin" class="textfield-border village-origin" placeholder="{{ 'add_village_search' | i18n:loc.ale:textObject }}" tooltip="" tooltip-content="{{ 'add_origin' | i18n:loc.ale:textObject }}" ng-keyup="searchVillage('origin')"></td><td class="text-center"><span class="icon-26x26-rte-village"></span></td><td ng-if="!commandData.origin">{{ 'add_no_village' | i18n:loc.ale:textObject }}</td><td ng-if="commandData.origin">{{ commandData.origin.name }} ({{ commandData.origin.x }}|{{ commandData.origin.y }})</td><td class="actions"><a class="btn btn-orange" ng-click="addSelected()" tooltip="" tooltip-content="{{ 'add_selected' | i18n:loc.ale:textObject }}">{{ 'selected' | i18n:loc.ale:textObjectCommon }}</a></td></tr><tr><td><input type="text" ng-model="searchQuery.target" class="textfield-border village-target" placeholder="{{ 'add_village_search' | i18n:loc.ale:textObject }}" tooltip="" tooltip-content="{{ 'add_target' | i18n:loc.ale:textObject }}" ng-keyup="searchVillage('target')"></td><td class="text-center"><span class="icon-26x26-rte-village"></span></td><td ng-if="!commandData.target">{{ 'add_no_village' | i18n:loc.ale:textObject }}</td><td ng-if="commandData.target">{{ commandData.target.name }} ({{ commandData.target.x }}|{{ commandData.target.y }})</td><td class="actions"><a class="btn btn-orange" ng-click="addMapSelected()" tooltip="" tooltip-content="{{ 'add_map_selected' | i18n:loc.ale:textObject }}">{{ 'selected' | i18n:loc.ale:textObjectCommon }}</a></td></tr><tr><td><input ng-model="commandData.date" type="text" class="textfield-border date" pattern="\\s*\\d{1,2}:\\d{1,2}:\\d{1,2}(:\\d{1,3})? \\d{1,2}\\/\\d{1,2}\\/\\d{4}\\s*" placeholder="{{ 'add_date' | i18n:loc.ale:textObject }}" tooltip="" tooltip-content="hh:mm:ss:SSS dd/MM/yyyy"></td><td class="text-center"><span class="icon-26x26-time"></span></td><td><div select="" list="dateTypes" selected="selectedDateType"></div></td><td class="actions"><a class="btn btn-orange" ng-click="reduceDate()" tooltip="" tooltip-content="{{ 'add_current_date_minus' | i18n:loc.ale:textObject }}">-</a><a class="btn btn-orange" ng-click="addCurrentDate()" tooltip="" tooltip-content="{{ 'add_current_date' | i18n:loc.ale:textObject }}">{{ 'now' | i18n:loc.ale:textObjectCommon }}</a><a class="btn btn-orange" ng-click="incrementDate()" tooltip="" tooltip-content="{{ 'add_current_date_plus' | i18n:loc.ale:textObject }}">+</a></td></tr></tbody></table><table ng-show="commandData.origin && commandData.target" class="tbl-border-light tbl-units tbl-speed screen-village-info"><thead><tr><th colspan="7">{{ 'speed_title' | i18n:loc.ale:textObjectVillageInfo }}</th></tr></thead><tbody><tr><td class="odd"><div class="unit-wrap"><span class="icon icon-34x34-unit-knight" tooltip="" tooltip-content="{{ 'knight' | i18n:loc.ale:textObjectUnitNames }}"></span> <span class="icon icon-34x34-unit-light_cavalry" tooltip="" tooltip-content="{{ 'light_cavalry' | i18n:loc.ale:textObjectUnitNames }}"></span> <span class="icon icon-34x34-unit-mounted_archer" tooltip="" tooltip-content="{{ 'mounted_archer' | i18n:loc.ale:textObjectUnitNames }}"></span></div><div><div class="box-time-sub-icon time-support" ng-class="{'text-red': travelTimes.support.light_cavalry.valueType == 'invalid', 'text-green-bright': travelTimes.support.light_cavalry.valueType == 'valid'}" tooltip="" tooltip-content="{{ 'travel_time_support' | i18n:loc.ale:textObjectMilitaryOperations }}"><div class="time-icon icon-20x20-support-check"></div>{{ travelTimes.support.light_cavalry.value }}</div><div class="box-time-sub-icon time-attack" ng-class="{'text-red': travelTimes.attack.light_cavalry.valueType == 'invalid', 'text-green-bright': travelTimes.attack.light_cavalry.valueType == 'valid'}" tooltip="" tooltip-content="{{ 'travel_time_attack' | i18n:loc.ale:textObjectMilitaryOperations }}"><div class="time-icon icon-20x20-attack-check"></div>{{ travelTimes.attack.light_cavalry.value }}</div><div class="box-time-sub-icon time-relocate" ng-class="{'text-red': travelTimes.relocate.light_cavalry.valueType == 'invalid', 'text-green-bright': travelTimes.relocate.light_cavalry.valueType == 'valid'}" tooltip="" tooltip-content="{{ 'travel_time_relocate' | i18n:loc.ale:textObjectMilitaryOperations }}"><div class="time-icon icon-20x20-relocate"></div>{{ travelTimes.relocate.light_cavalry.value }}</div></div></td><td><div class="unit-wrap"><span class="icon icon-single icon-34x34-unit-heavy_cavalry" tooltip="" tooltip-content="{{ 'heavy_cavalry' | i18n:loc.ale:textObjectUnitNames }}"></span></div><div><div class="box-time-sub time-support" ng-class="{'text-red': travelTimes.support.heavy_cavalry.valueType == 'invalid', 'text-green-bright': travelTimes.support.heavy_cavalry.valueType == 'valid'}" tooltip="" tooltip-content="{{ 'travel_time_support' | i18n:loc.ale:textObjectMilitaryOperations }}">{{ travelTimes.support.heavy_cavalry.value }}</div><div class="box-time-sub time-attack" ng-class="{'text-red': travelTimes.support.heavy_cavalry.valueType == 'invalid', 'text-green-bright': travelTimes.support.heavy_cavalry.valueType == 'valid'}" tooltip="" tooltip-content="{{ 'travel_time_attack' | i18n:loc.ale:textObjectMilitaryOperations }}">{{ travelTimes.attack.heavy_cavalry.value }}</div><div class="box-time-sub time-relocate" ng-class="{'text-red': travelTimes.support.heavy_cavalry.valueType == 'invalid', 'text-green-bright': travelTimes.support.heavy_cavalry.valueType == 'valid'}" tooltip="" tooltip-content="{{ 'travel_time_relocate' | i18n:loc.ale:textObjectMilitaryOperations }}">{{ travelTimes.relocate.heavy_cavalry.value }}</div></div></td><td class="odd"><div class="unit-wrap"><span class="icon icon-34x34-unit-archer" tooltip="" tooltip-content="{{ 'archer' | i18n:loc.ale:textObjectUnitNames }}"></span> <span class="icon icon-34x34-unit-spear" tooltip="" tooltip-content="{{ 'spear' | i18n:loc.ale:textObjectUnitNames }}"></span> <span class="icon icon-34x34-unit-axe" tooltip="" tooltip-content="{{ 'axe' | i18n:loc.ale:textObjectUnitNames }}"></span> <span class="icon icon-34x34-unit-doppelsoldner" tooltip="" tooltip-content="{{ 'doppelsoldner' | i18n:loc.ale:textObjectUnitNames }}"></span></div><div><div class="box-time-sub time-support" ng-class="{'text-red': travelTimes.support.archer.valueType == 'invalid', 'text-green-bright': travelTimes.support.archer.valueType == 'valid'}" tooltip="" tooltip-content="{{ 'travel_time_support' | i18n:loc.ale:textObjectMilitaryOperations }}">{{ travelTimes.support.archer.value }}</div><div class="box-time-sub time-attack" ng-class="{'text-red': travelTimes.support.archer.valueType == 'invalid', 'text-green-bright': travelTimes.support.archer.valueType == 'valid'}" tooltip="" tooltip-content="{{ 'travel_time_attack' | i18n:loc.ale:textObjectMilitaryOperations }}">{{ travelTimes.attack.archer.value }}</div><div class="box-time-sub time-relocate" ng-class="{'text-red': travelTimes.support.archer.valueType == 'invalid', 'text-green-bright': travelTimes.support.archer.valueType == 'valid'}" tooltip="" tooltip-content="{{ 'travel_time_relocate' | i18n:loc.ale:textObjectMilitaryOperations }}">{{ travelTimes.relocate.archer.value }}</div></div></td><td><div class="unit-wrap"><span class="icon icon-single icon-34x34-unit-sword" tooltip="" tooltip-content="{{ 'sword' | i18n:loc.ale:textObjectUnitNames }}"></span></div><div><div class="box-time-sub time-support" ng-class="{'text-red': travelTimes.support.sword.valueType == 'invalid', 'text-green-bright': travelTimes.support.sword.valueType == 'valid'}" tooltip="" tooltip-content="{{ 'travel_time_support' | i18n:loc.ale:textObjectMilitaryOperations }}">{{ travelTimes.support.sword.value }}</div><div class="box-time-sub time-attack" ng-class="{'text-red': travelTimes.support.sword.valueType == 'invalid', 'text-green-bright': travelTimes.support.sword.valueType == 'valid'}" tooltip="" tooltip-content="{{ 'travel_time_attack' | i18n:loc.ale:textObjectMilitaryOperations }}">{{ travelTimes.attack.sword.value }}</div><div class="box-time-sub time-relocate" ng-class="{'text-red': travelTimes.support.sword.valueType == 'invalid', 'text-green-bright': travelTimes.support.sword.valueType == 'valid'}" tooltip="" tooltip-content="{{ 'travel_time_relocate' | i18n:loc.ale:textObjectMilitaryOperations }}">{{ travelTimes.relocate.sword.value }}</div></div></td><td class="odd"><div class="unit-wrap"><span class="icon icon-34x34-unit-catapult" tooltip="" tooltip-content="{{ 'catapult' | i18n:loc.ale:textObjectUnitNames }}"></span> <span class="icon icon-34x34-unit-ram" tooltip="" tooltip-content="{{ 'ram' | i18n:loc.ale:textObjectUnitNames }}"></span></div><div><div class="box-time-sub time-support" ng-class="{'text-red': travelTimes.support.ram.valueType == 'invalid', 'text-green-bright': travelTimes.support.ram.valueType == 'valid'}" tooltip="" tooltip-content="{{ 'travel_time_support' | i18n:loc.ale:textObjectMilitaryOperations }}">{{ travelTimes.support.ram.value }}</div><div class="box-time-sub time-attack" ng-class="{'text-red': travelTimes.support.ram.valueType == 'invalid', 'text-green-bright': travelTimes.support.ram.valueType == 'valid'}" tooltip="" tooltip-content="{{ 'travel_time_attack' | i18n:loc.ale:textObjectMilitaryOperations }}">{{ travelTimes.attack.ram.value }}</div><div class="box-time-sub time-relocate" ng-class="{'text-red': travelTimes.support.ram.valueType == 'invalid', 'text-green-bright': travelTimes.support.ram.valueType == 'valid'}" tooltip="" tooltip-content="{{ 'travel_time_relocate' | i18n:loc.ale:textObjectMilitaryOperations }}">{{ travelTimes.relocate.ram.value }}</div></div></td><td><div class="unit-wrap"><span class="icon icon-single icon-34x34-unit-snob" tooltip="" tooltip-content="{{ 'snob' | i18n:loc.ale:textObjectUnitNames }}"></span></div><div><div class="box-time-sub time-support" ng-class="{'text-red': travelTimes.support.snob.valueType == 'invalid', 'text-green-bright': travelTimes.support.snob.valueType == 'valid'}" tooltip="" tooltip-content="{{ 'travel_time_support' | i18n:loc.ale:textObjectMilitaryOperations }}">{{ travelTimes.support.snob.value }}</div><div class="box-time-sub time-attack" ng-class="{'text-red': travelTimes.support.snob.valueType == 'invalid', 'text-green-bright': travelTimes.support.snob.valueType == 'valid'}" tooltip="" tooltip-content="{{ 'travel_time_attack' | i18n:loc.ale:textObjectMilitaryOperations }}">{{ travelTimes.attack.snob.value }}</div><div class="box-time-sub time-relocate" ng-class="{'text-red': travelTimes.support.snob.valueType == 'invalid', 'text-green-bright': travelTimes.support.snob.valueType == 'valid'}" tooltip="" tooltip-content="{{ 'cannot_relocate_snob' | i18n:loc.ale:textObjectMilitaryOperations }}">-</div></div></td><td class="odd"><div class="unit-wrap"><span class="icon icon-single icon-34x34-unit-trebuchet" tooltip="" tooltip-content="{{ 'trebuchet' | i18n:loc.ale:textObjectUnitNames }}"></span></div><div><div class="box-time-sub time-support" ng-class="{'text-red': travelTimes.support.trebuchet.valueType == 'invalid', 'text-green-bright': travelTimes.support.trebuchet.valueType == 'valid'}" tooltip="" tooltip-content="{{ 'travel_time_support' | i18n:loc.ale:textObjectMilitaryOperations }}">{{ travelTimes.support.trebuchet.value }}</div><div class="box-time-sub time-attack" ng-class="{'text-red': travelTimes.support.trebuchet.valueType == 'invalid', 'text-green-bright': travelTimes.support.trebuchet.valueType == 'valid'}" tooltip="" tooltip-content="{{ 'travel_time_attack' | i18n:loc.ale:textObjectMilitaryOperations }}">{{ travelTimes.attack.trebuchet.value }}</div><div class="box-time-sub time-relocate" ng-class="{'text-red': travelTimes.support.trebuchet.valueType == 'invalid', 'text-green-bright': travelTimes.support.trebuchet.valueType == 'valid'}" tooltip="" tooltip-content="{{ 'travel_time_relocate' | i18n:loc.ale:textObjectMilitaryOperations }}">{{ travelTimes.relocate.trebuchet.value }}</div></div></td></tr></tbody></table></div><h5 class="twx-section">{{ 'units' | i18n:loc.ale:textObjectCommon }}</h5><table class="tbl-border-light tbl-striped"><colgroup><col width="25%"><col width="25%"><col width="25%"><col width="25%"></colgroup><tbody class="add-units"><tr><td colspan="4" class="actions"><ul class="list-btn list-center"><li><div select="" list="presets" selected="selectedInsertPreset" drop-down="true"></div></li><li><a class="clear-units btn btn-orange" ng-click="cleanUnitInputs()">{{ 'add_clear' | i18n:loc.ale:textObject }}</a></li></ul></td></tr><tr ng-repeat="i in [] | range:(unitOrder.length / 4);"><td class="cell-space-left"><span class="icon-bg-black" ng-class="'icon-34x34-unit-' + unitOrder[i * 4]" tooltip="" tooltip-content="{{ unitOrder[i * 4] | i18n:loc.ale:textObjectUnitNames }}"></span> <input remove-zero="" type="text" ng-model="commandData.units[unitOrder[i * 4]]" maxlength="5" placeholder="{{ commandData.units[unitOrder[i * 4]] }}" ng-focus="onUnitInputFocus(unitOrder[i * 4])" ng-blur="onUnitInputBlur(unitOrder[i * 4])"></td><td class="cell-space-left"><span class="icon-bg-black" ng-class="'icon-34x34-unit-' + unitOrder[i * 4 + 1]" tooltip="" tooltip-content="{{ unitOrder[i * 4 + 1] | i18n:loc.ale:textObjectUnitNames }}"></span> <input remove-zero="" type="text" ng-model="commandData.units[unitOrder[i * 4 + 1]]" maxlength="5" placeholder="{{ commandData.units[unitOrder[i * 4 + 1]] }}" ng-focus="onUnitInputFocus(unitOrder[i * 4 + 1])" ng-blur="onUnitInputBlur(unitOrder[i * 4 + 1])"></td><td class="cell-space-left"><span class="icon-bg-black" ng-class="'icon-34x34-unit-' + unitOrder[i * 4 + 2]" tooltip="" tooltip-content="{{ unitOrder[i * 4 + 2] | i18n:loc.ale:textObjectUnitNames }}"></span> <input remove-zero="" type="text" ng-model="commandData.units[unitOrder[i * 4 + 2]]" maxlength="5" placeholder="{{ commandData.units[unitOrder[i * 4 + 2]] }}" ng-focus="onUnitInputFocus(unitOrder[i * 4 + 2])" ng-blur="onUnitInputBlur(unitOrder[i * 4 + 2])"></td><td class="cell-space-left"><span class="icon-bg-black" ng-class="'icon-34x34-unit-' + unitOrder[i * 4 + 3]" tooltip="" tooltip-content="{{ unitOrder[i * 4 + 3] | i18n:loc.ale:textObjectUnitNames }}"></span> <input remove-zero="" type="text" ng-model="commandData.units[unitOrder[i * 4 + 3]]" maxlength="5" placeholder="{{ commandData.units[unitOrder[i * 4 + 3]] }}" ng-focus="onUnitInputFocus(unitOrder[i * 4 + 3])" ng-blur="onUnitInputBlur(unitOrder[i * 4 + 3])"></td></tr><tr><td class="cell-space-left"><span class="icon-bg-black icon-34x34-unit-catapult" tooltip="" tooltip-content="{{ 'catapult' | i18n:loc.ale:textObjectUnitNames }}"></span> <input remove-zero="" type="text" ng-model="commandData.units.catapult" maxlength="5" placeholder="{{ commandData.units.catapult }}" ng-keyup="catapultTargetVisibility()" ng-focus="onUnitInputFocus('catapult')" ng-blur="onUnitInputBlur('catapult')"></td><td class="cell-space-left" colspan="3"><div ng-visible="showCatapultSelect"><div class="unit-border box-slider"><div class="height-wrapper"><div select="" list="attackableBuildings" selected="catapultTarget"></div></div></div></div></td></tr></tbody></table><h5 class="twx-section">{{ 'officers' | i18n:loc.ale:textObjectCommon }}</h5><table class="add-officers margin-top tbl-border-light tbl-officers"><tbody><tr><td class="cell-officers" ng-repeat="officer in officers"><table class="tbl-border-dark tbl-officer"><tbody><tr><td class="cell-space"><span class="icon-44x44-premium_officer_{{ officer }}"></span></td><td class="cell-officer-switch" rowspan="2"><div switch-slider="" enabled="true" value="commandData.officers[officer]" vertical="true" size="'34x66'"></div></td></tr><tr><td tooltip="" tooltip-content="{{ 'available_officers' | i18n:loc.ale:'modal_preset_edit' }}"><div class="amount">{{ inventory.getItemAmountByType('premium_officer_' + officer) | number }}</div></td></tr></tbody></table></td></tr></tbody></table></form></div><div class="waiting rich-text" ng-show="selectedTab === TAB_TYPES.WAITING"><div class="filters"><table class="tbl-border-light"><tbody><tr><td><div ng-class="{'active': activeFilters[FILTER_TYPES.SELECTED_VILLAGE]}" ng-click="toggleFilter(FILTER_TYPES.SELECTED_VILLAGE)" class="box-border-dark icon selectedVillage" tooltip="" tooltip-content="{{ 'filters_selected_village' | i18n:loc.ale:textObject }}"><span class="icon-34x34-village-info icon-bg-black"></span></div><div ng-class="{'active': activeFilters[FILTER_TYPES.BARBARIAN_TARGET]}" ng-click="toggleFilter(FILTER_TYPES.BARBARIAN_TARGET)" class="box-border-dark icon barbarianTarget" tooltip="" tooltip-content="{{ 'filters_barbarian_target' | i18n:loc.ale:textObject }}"><span class="icon-34x34-barbarian-village icon-bg-black"></span></div><div ng-class="{'active': activeFilters[FILTER_TYPES.ATTACK]}" ng-click="toggleFilter(FILTER_TYPES.ATTACK, true)" class="box-border-dark icon allowedTypes" tooltip="" tooltip-content="{{ 'filters_attack' | i18n:loc.ale:textObject }}"><span class="icon-34x34-attack icon-bg-black"></span></div><div ng-class="{'active': activeFilters[FILTER_TYPES.SUPPORT]}" ng-click="toggleFilter(FILTER_TYPES.SUPPORT, true)" class="box-border-dark icon allowedTypes" tooltip="" tooltip-content="{{ 'filters_support' | i18n:loc.ale:textObject }}"><span class="icon-34x34-support icon-bg-black"></span></div><div ng-class="{'active': activeFilters[FILTER_TYPES.RELOCATE]}" ng-click="toggleFilter(FILTER_TYPES.RELOCATE, true)" class="box-border-dark icon allowedTypes" tooltip="" tooltip-content="{{ 'filters_relocate' | i18n:loc.ale:textObject }}"><span class="icon-34x34-relocate icon-bg-black"></span></div><div class="text"><input ng-model="filtersData[FILTER_TYPES.TEXT_MATCH]" type="text" class="box-border-dark" placeholder="{{ 'filters_text_match' | i18n:loc.ale:textObject }}"></div></td></tr></tbody></table></div><div class="queue"><h5 class="twx-section">{{ 'queue_waiting' | i18n:loc.ale:textObject }}</h5><p class="text-center" ng-show="!visibleWaitingCommands.length">{{ 'queue_none_added' | i18n:loc.ale:textObject }}</p><table class="tbl-border-light" ng-repeat="command in visibleWaitingCommands"><colgroup><col width="100px"></colgroup><tbody><tr><th colspan="2"><span ng-class="{true: 'icon-bg-red', false:'icon-bg-blue'}[command.type === 'attack']" class="icon-26x26-{{ command.type }}" tooltip="" tooltip-content="{{ command.type | i18n:loc.ale:textObjectCommon }}"></span> <span class="size-26x26 icon-bg-black icon-26x26-time-duration" tooltip="" tooltip-content="{{ 'command_time_left' | i18n:loc.ale:textObject }}"></span> <span class="time-left">{{ command.countdown() }}</span> <span class="size-26x26 icon-bg-black icon-20x20-units-outgoing" tooltip="" tooltip-content="{{ 'command_out' | i18n:loc.ale:textObject }}"></span> <span class="sent-time">{{ command.sendTime | readableDateFilter:loc.ale:GAME_TIMEZONE:GAME_TIME_OFFSET }}</span> <span class="size-26x26 icon-bg-black icon-20x20-time-arrival" tooltip="" tooltip-content="{{ 'command_arrive' | i18n:loc.ale:textObject }}"></span> <span class="arrive-time">{{ command.arriveTime | readableDateFilter:loc.ale:GAME_TIMEZONE:GAME_TIME_OFFSET }}</span> <a href="#" class="remove-command size-20x20 btn-red icon-20x20-close" ng-click="removeCommand(command, EVENT_CODES.COMMAND_REMOVED)" tooltip="" tooltip-content="{{ 'queue_remove' | i18n:loc.ale:textObject }}"></a></th></tr><tr><td>{{ 'villages' | i18n:loc.ale:textObjectCommon }}</td><td><a class="origin"><span class="village-link img-link icon-20x20-village btn btn-orange padded" ng-click="openVillageInfo(command.origin.id)">{{ command.origin.name }} ({{ command.origin.x }}|{{ command.origin.y }})</span></a> <span class="size-20x20 icon-26x26-{{ command.type }}"></span> <a class="target"><span class="village-link img-link icon-20x20-village btn btn-orange padded" ng-click="openVillageInfo(command.target.id)">{{ command.target.name }} ({{ command.target.x }}|{{ command.target.y }})</span></a></td></tr><tr><td>{{ 'units' | i18n:loc.ale:textObjectCommon }}</td><td class="units"><div class="unit" ng-repeat="(unit, amount) in command.units"><span class="icon-34x34-unit-{{ unit }} icon"></span> <span class="amount">{{ amount }}</span> <span ng-if="unit === 'catapult' && command.type === 'attack'">({{ command.catapultTarget | i18n:loc.ale:textObjectCommon }})</span></div><div class="officer" ng-repeat="(officer, enabled) in command.officers"><span class="icon-34x34-premium_officer_{{ officer }}"></span></div></td></tr></tbody></table></div></div><div class="logs rich-text" ng-show="selectedTab === TAB_TYPES.LOGS"><h5 class="twx-section">{{ 'queue_sent' | i18n:loc.ale:textObject }}</h5><p class="text-center" ng-show="!sentCommands.length">{{ 'queue_none_sent' | i18n:loc.ale:textObject }}</p><table class="tbl-border-light" ng-repeat="command in sentCommands track by $index"><colgroup><col width="100px"></colgroup><tbody><tr><th colspan="2"><span ng-class="{true: 'icon-bg-red', false:'icon-bg-blue'}[command.type === 'attack']" class="icon-26x26-{{ command.type }}" tooltip="" tooltip-content="{{ command.type | i18n:loc.ale:textObjectCommon }}"></span> <span class="size-26x26 icon-bg-black icon-20x20-units-outgoing" tooltip="" tooltip-content="{{ 'command_out' | i18n:loc.ale:textObject }}"></span> <span class="sent-time">{{ command.sendTime | readableDateFilter:loc.ale:GAME_TIMEZONE:GAME_TIME_OFFSET }}</span> <span class="size-26x26 icon-bg-black icon-20x20-time-arrival" tooltip="" tooltip-content="{{ 'command_arrive' | i18n:loc.ale:textObject }}"></span> <span class="arrive-time">{{ command.arriveTime | readableDateFilter:loc.ale:GAME_TIMEZONE:GAME_TIME_OFFSET }}</span></th></tr><tr><td>{{ 'villages' | i18n:loc.ale:textObjectCommon }}</td><td><a class="origin"><span class="village-link img-link icon-20x20-village btn btn-orange padded" ng-click="openVillageInfo(command.origin.id)">{{ command.origin.name }} ({{ command.origin.x }}|{{ command.origin.y }})</span></a> <span class="size-20x20 icon-26x26-{{ command.type }}"></span> <a class="target"><span class="village-link img-link icon-20x20-village btn btn-orange padded" ng-click="openVillageInfo(command.target.id)">{{ command.target.name }} ({{ command.target.x }}|{{ command.target.y }})</span></a></td></tr><tr><td>{{ 'units' | i18n:loc.ale:textObjectCommon }}</td><td class="units"><div class="unit" ng-repeat="(unit, amount) in command.units"><span class="icon-34x34-unit-{{ unit }} icon"></span> <span class="amount">{{ amount }}</span> <span ng-if="unit === 'catapult' && command.type === 'attack'">({{ command.catapultTarget | i18n:loc.ale:textObjectCommon }})</span></div><div class="officer" ng-repeat="(officer, enabled) in command.officers"><span class="icon-34x34-premium_officer_{{ officer }}"></span></div></td></tr></tbody></table><h5 class="twx-section">{{ 'queue_expired' | i18n:loc.ale:textObject }}</h5><p class="text-center" ng-show="!expiredCommands.length">{{ 'queue_none_expired' | i18n:loc.ale:textObject }}</p><table class="tbl-border-light" ng-repeat="command in expiredCommands track by $index"><colgroup><col width="100px"></colgroup><tbody><tr><th colspan="2"><span ng-class="{true: 'icon-bg-red', false:'icon-bg-blue'}[command.type === 'attack']" class="icon-26x26-{{ command.type }}" tooltip="" tooltip-content="{{ command.type | i18n:loc.ale:textObjectCommon }}"></span> <span class="size-26x26 icon-bg-black icon-20x20-units-outgoing" tooltip="" tooltip-content="{{ 'command_out' | i18n:loc.ale:textObject }}"></span> <span class="sent-time">{{ command.sendTime | readableDateFilter:loc.ale:GAME_TIMEZONE:GAME_TIME_OFFSET }}</span> <span class="size-26x26 icon-bg-black icon-20x20-time-arrival" tooltip="" tooltip-content="{{ 'command_arrive' | i18n:loc.ale:textObject }}"></span> <span class="arrive-time">{{ command.arriveTime | readableDateFilter:loc.ale:GAME_TIMEZONE:GAME_TIME_OFFSET }}</span></th></tr><tr><td>{{ 'villages' | i18n:loc.ale:textObjectCommon }}</td><td><a class="origin"><span class="village-link img-link icon-20x20-village btn btn-orange padded" ng-click="openVillageInfo(command.origin.id)">{{ command.origin.name }} ({{ command.origin.x }}|{{ command.origin.y }})</span></a> <span class="size-20x20 icon-26x26-{{ command.type }}"></span> <a class="target"><span class="village-link img-link icon-20x20-village btn btn-orange padded" ng-click="openVillageInfo(command.target.id)">{{ command.target.name }} ({{ command.target.x }}|{{ command.target.y }})</span></a></td></tr><tr><td>{{ 'units' | i18n:loc.ale:textObjectCommon }}</td><td class="units"><div class="unit" ng-repeat="(unit, amount) in command.units"><span class="icon-34x34-unit-{{ unit }} icon"></span> <span class="amount">{{ amount }}</span> <span ng-if="unit === 'catapult' && command.type === 'attack'">({{ command.catapultTarget | i18n:loc.ale:textObjectCommon }})</span></div><div class="officer" ng-repeat="(officer, enabled) in command.officers"><span class="icon-34x34-premium_officer_{{ officer }}"></span></div></td></tr></tbody></table></div></div></div></div><footer class="win-foot"><ul class="list-btn list-center"><li ng-show="selectedTab === TAB_TYPES.LOGS"><a class="btn-orange btn-border" ng-click="clearRegisters()">{{ 'general_clear' | i18n:loc.ale:textObject }}</a></li><li ng-show="selectedTab === TAB_TYPES.ADD"><a class="btn-orange btn-border add" ng-click="addCommand('attack')"><span class="icon-26x26-attack-small"></span> {{ 'attack' | i18n:loc.ale:textObjectCommon }}</a></li><li ng-show="selectedTab === TAB_TYPES.ADD"><a class="btn-orange btn-border add" ng-click="addCommand('support')"><span class="icon-26x26-support"></span> {{ 'support' | i18n:loc.ale:textObjectCommon }}</a></li><li ng-show="selectedTab === TAB_TYPES.ADD"><a class="btn-orange btn-border add" ng-click="addCommand('relocate')"><span class="icon-26x26-relocate"></span> {{ 'relocate' | i18n:loc.ale:textObjectCommon }}</a></li><li><a href="#" ng-class="{false:'btn-green', true:'btn-red'}[running]" class="btn-border" ng-click="switchCommandQueue()"><span ng-show="running">{{ 'deactivate' | i18n:loc.ale:textObjectCommon }}</span> <span ng-show="!running">{{ 'activate' | i18n:loc.ale:textObjectCommon }}</span></a></li></ul></footer></div>`)
        interfaceOverflow.addStyle('#two-commandqueue input[type="text"]{width:200px}#two-commandqueue input.unit{width:80px;height:34px}#two-commandqueue form .padded{padding:2px 8px}#two-commandqueue a.select-handler{-webkit-box-shadow:none;box-shadow:none;height:22px;line-height:22px}#two-commandqueue a.select-button{height:22px}#two-commandqueue .custom-select{width:240px}#two-commandqueue .originVillage,#two-commandqueue .targetVillage{padding:0 7px}#two-commandqueue a.btn{height:28px;line-height:28px;padding:0 10px}#two-commandqueue .actions{text-align:center}#two-commandqueue .add-units td{text-align:center}#two-commandqueue .add-units .unit-icon{top:-1px}#two-commandqueue .add-units input{height:34px;line-height:26px;color:#fff3d0;font-size:14px;background:url(data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADIAAAAyCAMAAAAp4XiDAAAABGdBTUEAALGPC/xhBQAAALRQTFRFr6+vmJiYoKCgrKysq6urpaWltLS0s7OzsLCwpKSkm5ubqKiojY2NlZWVk5OTqampbGxsWFhYUVFRhISEgYGBmpqaUFBQnp6eYmJidnZ2nZ2dY2NjW1tbZ2dnoaGhe3t7l5eXg4ODVVVVWVlZj4+PXFxcVlZWkpKSZmZmdXV1ZWVlc3NzjIyMXl5eVFRUeHh4hoaGYWFhXV1dbW1tampqb29veXl5fHx8gICAiYmJcnJyTk5Ooj6l1wAAADx0Uk5TGhkZGhoaGxoaGRkaGRkZGhkbHBgYGR0ZGhkZGhsZGRgZGRwbGRscGRoZGhkZGhwZGRobGRkZGRkZGRkeyXExWQAABOJJREFUSMeNVgdy4zgQxIW9TQ7KOVEUo5gz0f//1/WA0sple6+OLokQiUk9PQ2rvlzvT0vA6xDXU3R5hQmqddDVaIELsMl3KLUGoFHugUphjt25PWkE6KMAqPkO/Qh7HRadPmTNxKJpWuhSjLZAoSZmXYoPXh0w2R2z10rjBxpMNRfomhbNFUfUFbfUCh6TWmO4ZqNn6Jxekx6lte3h9IgYv9ZwzIZXfhQ/bejmsYkgOeVInoDGT6KGP9MMbsj7mtEKphKgVFKkJGUM+r/00zybNkPMFWYske+jY9hUblbrK4YosyPtrxl+5kNRWSb2B3+pceKT05SQRPZY8pVSGoWutgen2junRVKPZJ0v5Nu9HAk/CFPr+T1XTkXYFWSJXfTyLPcpcPXtBZIPONq/cFQ0Y0Lr1GF6f5doHdm2RLTbQMpMmCIf/HGm53OLFPiiEOsBKtgHccgKTVwn8l7kbt3iPvqniMX4jgWj4aqlX43xLwXVet5XTG1cYp/29m58q6ULSa7V0M3UQFyjd+AD+1W9WLBpDd9uej7emFbea/+Yw8faySElQQrBDksTpTOVIG/SE2HpPvZsplJWsblRLEGXATEW9YLUY1rPSdivBDmuK3exNiAysfPALfYZFWJrsA4Zt+fftEeRY0UsMDqfyNCKJpdrtI1r2k0vp9LMSwdO0u5SpjBeEYz5ebhWNbwT2g7OJXy1vjW+pEwyd1FTkAtbzzcbmX1yZlkR2pPiXZ/mDbPNWvHRsaKfLH8+FqiZbnodbOK9RGWlNMli8k+wsgbSNwS35QB6qxn53xhu2DFqUilisB9q2Zqw4nNI9tOB2z8GbkvEdNjPaD2j+9pwEC+YlWJvI7xN7xMC09eqhq/qwRvz3JWcFWmkjrWBWSiOysEmc4LmMb0iSsxR8+Z8pk3+oE39cdAmh1xSDXuAryRLZgpp9V62+8IOeBSICjs8LlbtKGN4E7XGoGASIJ+vronVa5mjagPHIFJA2b+BKkZC5I/78wOqmzYp1N8vzTkWIWz6YfsS3eh3w8pBkfKz6TSLxK9Qai5DUGTMZ8NNmrW8ldNudIJq+eJycwjv+xbeOJwPv1jjsSV/rCBaS/IBrafaUQ+5ksHwwl9y9X7kmvvIKWoBDFvbWySGyMU3XflxZRkNeRU63otWb0+P8H8BrRokbJivpWkk6m6LccSlrC2K0i6+4otx4dN3mbAVKt0wbaqBab4/MW8rgrS8JP06HU6UYSTYsQ5pYETpo87ZonORvbPlvYbXwmsMgoQGKr8PUQ5dDEO0EcXp2oOfSk+YpR/Eg4R46O0/Sf7jVnbqbXBrRkCPsZFOQTN8h+aqlcRw9FjJ/j8V7SXZ3hVNXYsOYcxzpfPNgFrvB9S6Dej2PqDqq0su+5ng0WMi527p/pA+OiW0fsYzDa6sPS9C1qxTtxVRMuySrwPD6qGPRKc4uIx4oceJ9FPjxWaqPPebzyXxU7W1jNqqOw+9z6X/k+Na3SBa0v+VjgoaULR30G1nxvZN1vsha2UaSrKy/PyCaHK5zAYnJzm9RSpSPDWbDVu0dkUujMmB/ly4w8EnDdXXoyX/VfhB3yKzMJ2BSaZO+A9GiNQMbll+6z1WGLWpEGMeEg85MESSep0IPFaHYZZ1QOW/xcjfxGhNjP0tRtbhFHOmhhjAv/p77JrCX3+ZAAAAAElFTkSuQmCC) top left #b89064;box-shadow:inset 0 0 0 1px #000,inset 0 0 0 2px #a2682c,inset 0 0 0 3px #000,inset -3px -3px 2px 0 #fff,inset 0 0 9px 5px rgba(99,54,0,0.5);text-align:center;width:80px}#two-commandqueue .add-officers .cell-officers{padding:7px 11px 5px 11px}#two-commandqueue .add-officers .amount{color:#fff;text-align:center}#two-commandqueue .command{margin-bottom:10px}#two-commandqueue .command .time-left{width:93px;display:inline-block;padding:0 0 0 3px}#two-commandqueue .command .sent-time,#two-commandqueue .command .arrive-time{width:160px;display:inline-block;padding:0 0 0 5px}#two-commandqueue .command td{padding:3px 6px}#two-commandqueue .officers td{width:111px;text-align:center}#two-commandqueue .officers label{margin-left:5px}#two-commandqueue .officers span{margin-left:2px}#two-commandqueue .units div.unit{float:left}#two-commandqueue .units div.unit span.icon{transform:scale(.7);width:25px;height:25px}#two-commandqueue .units div.unit span.amount{vertical-align:-2px;margin:0 5px 0 2px}#two-commandqueue .units div.officer{float:left;margin:0 2px}#two-commandqueue .units div.officer span{transform:scale(.7);width:25px;height:25px}#two-commandqueue .remove-command{float:right;margin-top:3px}#two-commandqueue .tbl-units td{text-align:center}#two-commandqueue .tbl-speed{margin-top:10px}#two-commandqueue .tbl-speed th{text-align:center}#two-commandqueue .tbl-speed td{font-size:12px}#two-commandqueue .tbl-speed .box-time-sub-icon{position:relative}#two-commandqueue .tbl-speed .box-time-sub-icon .time-icon{position:absolute;top:-3px;left:27px;transform:scale(.7)}#two-commandqueue .tbl-speed .box-time-sub-icon.time-relocate .time-icon{top:-6px;left:26px}#two-commandqueue .dateType{width:200px}#two-commandqueue .dateType .custom-select-handler{text-align:left}#two-commandqueue .filters .icon{width:38px;float:left;margin:0 6px}#two-commandqueue .filters .icon.active:before{box-shadow:0 0 0 1px #000,-1px -1px 0 2px #ac9c44,0 0 0 3px #ac9c44,0 0 0 4px #000;border-radius:1px;content:"";position:absolute;width:38px;height:38px;left:-1px;top:-1px}#two-commandqueue .filters .text{margin-left:262px}#two-commandqueue .filters .text input{height:36px;margin-top:1px;width:100%;text-align:left;padding:0 5px}#two-commandqueue .filters .text input::placeholder{color:white}#two-commandqueue .filters .text input:focus::placeholder{color:transparent}#two-commandqueue .filters td{padding:6px}#two-commandqueue .icon-34x34-barbarian-village:before{filter:grayscale(100%);background-image:url(https://i.imgur.com/ozI4k0h.png);background-position:-220px -906px}#two-commandqueue .icon-20x20-time-arrival:before{transform:scale(.8);background-image:url(https://i.imgur.com/ozI4k0h.png);background-position:-529px -454px}#two-commandqueue .icon-20x20-attack:before{transform:scale(.8);background-image:url(https://i.imgur.com/ozI4k0h.png);background-position:-546px -1086px;width:26px;height:26px}#two-commandqueue .icon-20x20-support:before{transform:scale(.8);background-image:url(https://i.imgur.com/ozI4k0h.png);background-position:-462px -360px;width:26px;height:26px}#two-commandqueue .icon-20x20-relocate:before{transform:scale(.8);background-image:url(https://i.imgur.com/ozI4k0h.png);background-position:-1090px -130px;width:26px;height:26px}#two-commandqueue .icon-26x26-attack:before{background-image:url(https://i.imgur.com/ozI4k0h.png);background-position:-546px -1086px}')
    }

    var buildWindow = function () {
        $scope = window.$scope = $rootScope.$new()
        $scope.textObject = textObject
        $scope.textObjectCommon = textObjectCommon
        $scope.textObjectVillageInfo = 'screen_village_info'
        $scope.textObjectUnitNames = 'unit_names'
        $scope.textObjectMilitaryOperations = 'military_operations'
        $scope.selectedTab = DEFAULT_TAB
        $scope.inventory = modelDataService.getInventory()
        $scope.presets = utils.obj2selectOptions(presetList.getPresets())
        $scope.travelTimes = {}
        $scope.unitOrder = unitOrder
        $scope.officers = $gameData.getOrderedOfficerNames()
        $scope.searchQuery = {
            origin: '',
            target: ''
        }
        $scope.isValidDate = false
        $scope.dateTypes = util.toActionList(DATE_TYPES, function (actionType) {
            return $filter('i18n')('add_' + actionType, $rootScope.loc.ale, textObject)
        })
        $scope.selectedDateType = {
            name: $filter('i18n')('add_out', $rootScope.loc.ale, textObject),
            value: DATE_TYPES.OUT
        }
        $scope.selectedInsertPreset = {
            name: $filter('i18n')('add_insert_preset', $rootScope.loc.ale, textObject),
            value: null
        }
        $scope.catapultTarget = {
            name: $filter('i18n')(DEFAULT_CATAPULT_TARGET, $rootScope.loc.ale, 'building_names'),
            value: DEFAULT_CATAPULT_TARGET
        }
        $scope.showCatapultSelect = !!commandData.units.catapult
        $scope.attackableBuildings = attackableBuildingsList
        $scope.commandData = commandData
        $scope.activeFilters = activeFilters
        $scope.filtersData = filtersData
        $scope.running = commandQueue.isRunning()
        $scope.waitingCommands = commandQueue.getWaitingCommands()
        $scope.visibleWaitingCommands = commandQueue.getWaitingCommands()
        $scope.sentCommands = commandQueue.getSentCommands()
        $scope.expiredCommands = commandQueue.getExpiredCommands()
        $scope.EVENT_CODES = EVENT_CODES
        $scope.FILTER_TYPES = FILTER_TYPES
        $scope.TAB_TYPES = TAB_TYPES

        // functions
        $scope.onUnitInputFocus = onUnitInputFocus
        $scope.onUnitInputBlur = onUnitInputBlur
        $scope.catapultTargetVisibility = catapultTargetVisibility
        $scope.selectTab = selectTab
        $scope.addSelected = addSelected
        $scope.addMapSelected = addMapSelected
        $scope.addCurrentDate = addCurrentDate
        $scope.incrementDate = incrementDate
        $scope.reduceDate = reduceDate
        $scope.cleanUnitInputs = cleanUnitInputs
        $scope.searchVillage = searchVillage
        $scope.addCommand = addCommand
        $scope.clearRegisters = clearRegisters
        $scope.switchCommandQueue = switchCommandQueue
        $scope.removeCommand = commandQueue.removeCommand
        $scope.openVillageInfo = windowDisplayService.openVillageInfo
        $scope.toggleFilter = toggleFilter

        $scope.$watch('commandData.origin', updateTravelTimes)
        $scope.$watch('commandData.target', updateTravelTimes)
        $scope.$watch('commandData.date', updateTravelTimes)
        $scope.$watch('selectedDateType.value', updateDateType)
        $scope.$watch('selectedInsertPreset.value', insertPreset)
        $scope.$watch('filtersData[FILTER_TYPES.TEXT_MATCH]', textMatchFilter)

        eventScope = new EventScope('twoverflow_queue_window')
        eventScope.register(eventTypeProvider.ARMY_PRESET_UPDATE, eventHandlers.updatePresets, true)
        eventScope.register(eventTypeProvider.ARMY_PRESET_DELETED, eventHandlers.updatePresets, true)
        eventScope.register(eventTypeProvider.SELECT_SELECTED, eventHandlers.autoCompleteSelected, true)
        eventScope.register(eventTypeProvider.COMMAND_QUEUE_ADD_INVALID_ORIGIN, eventHandlers.addInvalidOrigin)
        eventScope.register(eventTypeProvider.COMMAND_QUEUE_ADD_INVALID_TARGET, eventHandlers.addInvalidTarget)
        eventScope.register(eventTypeProvider.COMMAND_QUEUE_ADD_INVALID_DATE, eventHandlers.addInvalidDate)
        eventScope.register(eventTypeProvider.COMMAND_QUEUE_ADD_NO_UNITS, eventHandlers.addNoUnits)
        eventScope.register(eventTypeProvider.COMMAND_QUEUE_ADD_ALREADY_SENT, eventHandlers.addAlreadySent)
        eventScope.register(eventTypeProvider.COMMAND_QUEUE_REMOVE, eventHandlers.removeCommand)
        eventScope.register(eventTypeProvider.COMMAND_QUEUE_REMOVE_ERROR, eventHandlers.removeError)
        eventScope.register(eventTypeProvider.COMMAND_QUEUE_SEND_TIME_LIMIT, eventHandlers.sendTimeLimit)
        eventScope.register(eventTypeProvider.COMMAND_QUEUE_SEND_NOT_OWN_VILLAGE, eventHandlers.sendNotOwnVillage)
        eventScope.register(eventTypeProvider.COMMAND_QUEUE_SEND_NO_UNITS_ENOUGH, eventHandlers.sendNoUnitsEnough)
        eventScope.register(eventTypeProvider.COMMAND_QUEUE_ADD, eventHandlers.addCommand)
        eventScope.register(eventTypeProvider.COMMAND_QUEUE_SEND, eventHandlers.sendCommand)
        eventScope.register(eventTypeProvider.COMMAND_QUEUE_START, eventHandlers.start)
        eventScope.register(eventTypeProvider.COMMAND_QUEUE_STOP, eventHandlers.stop)

        windowManagerService.getScreenWithInjectedScope('!twoverflow_queue_window', $scope)
    }

    return init
})

define('two/farm', [
    'two/farm/Village',
    'two/farm/errorTypes',
    'two/farm/settings',
    'two/farm/settingsMap',
    'two/farm/settingsUpdate',
    'two/farm/logTypes',
    'two/utils',
    'helper/math',
    'conf/conf',
    'struct/MapData',
    'helper/mapconvert',
    'helper/time',
    'conf/gameStates',
    'Lockr',
    'queues/EventQueue'
], function (
    Village,
    ERROR_TYPES,
    SETTINGS,
    SETTINGS_MAP,
    SETTINGS_UPDATE,
    LOG_TYPES,
    utils,
    math,
    conf,
    mapData,
    convert,
    timeHelper,
    GAME_STATES,
    Lockr,
    eventQueue
) {
    var initialized = false
    var commander = null
    var settings = {}
    var selectedTarget
    var selectedPresets = []
    var groupIgnore = false
    var groupInclude = []
    var groupOnly = []
    var ignoredVillages = []
    var includedVillages = []
    var waitingVillages = {}
    var logs = []
    var $player
    var $gameState
    var textObject = 'farm'
    var textObjectCommon = 'common'
    var STORAGE_ID = {
        INDEXES: 'farmoverflow_indexes',
        LOGS: 'farmoverflow_logs',
        LAST_ATTACK: 'farmoverflow_last_attack',
        LAST_ACTIVITY: 'farmoverflow_last_activity',
        SETTINGS: 'farmoverflow_settings'
    }
    var FARM_STATES = {
        ATTACKING: 'attacking',
        PAUSED: 'paused',
        NO_UNITS: 'no_units',
        NO_UNITS_NO_COMMANDS: 'no_units_no_commands',
        ATTACKING: 'attacking',
        PAUSED: 'paused',
        LOADING_TARGETS: 'loading_targets',
        ANALYSE_TARGETS: 'analyse_targets',
        COMMAND_LIMIT: 'command_limit',
        NO_VILLAGES: 'no_villages',
        STEP_CYCLE_END: 'step_cycle_end',
        STEP_CYCLE_END_NO_VILLAGES: 'step_cycle_end_no_villages',
        STEP_CYCLE_NEXT: 'step_cycle_next',
        FULL_STORAGE: 'full_storage'
    }
    var WAITING_STATES = {
        UNITS: 'units',
        COMMANDS: 'commands',
        FULL_STORAGE: 'full_storage'
    }
    var currentStatus = FARM_STATES.PAUSED

    /**
     * Expiration time for temporary data like: targets, priority list..
     * Value in seconds.
     */
    var DATA_EXPIRE_TIME = 1000 * 60 * 30

    /**
     * Interval to check if the farm is still working.
     * @see initPersistentRunning
     */
    var PERSISTENT_INTERVAL = 1000 * 60

    /**
     * Tolerance time after the last attack sent.
     */
    var PERSISTENT_TOLERANCE = 1000 * 60 * 5

    /**
     * Interval between each target renovation cycle.
     */
    var TARGETS_RELOAD_TIME = 1000 * 60 * 5

    /**
     * Villages ready to be used to send attacks.
     *
     * @type {Array<VillageModel>}
     */
    var playerVillages = []

    /**
     * Available villages to be used to farm.
     * Reseted every time that all villages are used.
     * 
     * @type {Array<VillageModel>}
     */
    var leftVillages = []

    /**
     * Current selected village used to send attacks.
     *
     * @type {VillageModel}
     */
    var selectedVillage

    /**
     * Identify if the player have a single village.
     *
     * @type {Boolean}
     */
    var singleVillage

    /**
     * Target list for each village available.
     *
     * @type {Object<Array>}
     */
    var villagesTargets = {}

    /**
     * Indicate if the farm is stopped because there's not a single village
     * avaiable to send attacks.
     */
    var globalWaiting = false

    /**
     * Store the last error event that stopped the farm.
     * Used on the status message whe the farm is manually restarted.
     */
    var lastError = ''

    /**
     * @type {Object<Array>}
     */
    var priorityTargets = {}

    /**
     * @type {Number} timestamp
     */
    var lastActivity

    /**
     * @type {Number} timestamp
     */
    var lastAttack

    /**
     * Store the index positon of the last target attacked for each village.
     *
     * @type {Object<Number>}
     */
    var targetIndexes

    /**
     * Filter loading map villages based on filter options.
     */
    var mapFilters = [
        // Village with negative id are meta villages (invite friend, deposit...)
        function metaVillages (target) {
            return target.id < 0
        },
        function ownPlayer (target) {
            return target.character_id === $player.getId()
        },
        function protectedVillage (target) {
            return !!target.attack_protection
        },
        function includedVillage (target) {
            return target.character_id && !includedVillages.includes(target.id)
        },
        function villagePoints (target) {
            return target.points < settings[SETTINGS.MIN_POINTS] || target.points > settings[SETTINGS.MAX_POINTS]
        },
        function villageDistance (target) {
            var distance = math.actualDistance(selectedVillage.position, target)
            return distance < settings[SETTINGS.MIN_DISTANCE] || distance > settings[SETTINGS.MAX_DISTANCE]
        }
    ]

    /**
     * Allow only values with more than zero units.
     * 
     * @param {Object} units
     */
    var cleanPresetUnits = function (units) {
        var pure = {}
        var unit

        for (unit in units) {
            if (units[unit] > 0) {
                pure[unit] = units[unit]
            }
        }

        return pure
    }

    var updateExceptionGroups = function () {
        if (!angular.isArray(settings[SETTINGS.GROUP_INCLUDE])) {
            console.error('groupInclude must be an Array')
            return false
        }

        if (!angular.isArray(settings[SETTINGS.GROUP_ONLY])) {
            console.error('groupOnly must be an Array')
            return false
        }

        groupIgnore = settings[SETTINGS.GROUP_IGNORE]
        groupInclude = settings[SETTINGS.GROUP_INCLUDE]
        groupOnly = settings[SETTINGS.GROUP_ONLY]
    }

    var updateExceptionVillages = function () {
        var groupList = modelDataService.getGroupList()
        var groups

        ignoredVillages = []
        includedVillages = []

        if (groupIgnore) {
            if (typeof groupIgnore !== 'number') {
                console.error('groupIgnore must be a id number')
            } else {
                ignoredVillages = groupList.getGroupVillageIds(groupIgnore)
            }
        }

        if (groupInclude.length) {
            groupInclude.forEach(function (groupId) {
                groups = groupList.getGroupVillageIds(groupId)
                includedVillages = includedVillages.concat(groups)
            })
        }
    }

    var updatePlayerVillages = function () {
        var villages = $player.getVillageList()
            .map(function (village) {
                return new Village(village)
            })
            .filter(function (village) {
                return !ignoredVillages.includes(village.id)
            })
        var groupList
        var groupVillages

        if (groupOnly.length) {
            groupList = modelDataService.getGroupList()
            groupVillages = []

            groupOnly.forEach(function (groupId) {
                groupVillages = groupVillages.concat(groupList.getGroupVillageIds(groupId))
            })

            villages = villages.filter(function (village) {
                return groupVillages.includes(village.id)
            })
        }

        playerVillages = villages
        singleVillage = playerVillages.length === 1
        selectedVillage = playerVillages[0]

        // If a village that wasn't in the available list before
        // is now included. The farm start the attacks imediatelly.
        if (commander.running && globalWaiting) {
            villages.some(function (village) {
                if (!waitingVillages[village.id]) {
                    globalWaiting = false
                    commander.analyse()

                    return true
                }
            })
        }

        eventQueue.trigger(eventTypeProvider.FARM_VILLAGES_UPDATE)
    }

    var convertListPresets = function (presetsArray) {
        var presets = {}

        presetsArray.forEach(function (preset) {
            presets[preset.id] = preset
        })

        return presets
    }

    /**
     * Get the list of presets (load from the server, if necessary)
     * and update/populate the selectedPresets variable.
     */
    var updatePresets = function (callback) {
        var update = function (presetsObj) {
            selectedPresets = []

            if (!settings[SETTINGS.PRESETS].length) {
                if (callback) {
                    callback()
                }

                return
            }

            settings[SETTINGS.PRESETS].forEach(function (presetId) {
                selectedPresets.push({
                    id: presetId,
                    units: cleanPresetUnits(presetsObj[presetId].units)
                })
            })

            if (callback) {
                callback()
            }
        }

        if (modelDataService.getPresetList().isLoaded()) {
            update(modelDataService.getPresetList().getPresets())
        } else {
            socketService.emit(routeProvider.GET_PRESETS, {}, function (data) {
                eventQueue.trigger(eventTypeProvider.FARM_PRESETS_LOADED)
                update(convertListPresets(data.presets))
            })
        }
    }

    var reportListener = function () {
        var reportQueue = []

        /**
         * Add the target to the ignore list if the village is a
         * active target for some of the player's village that are
         * being used to farm.
         *
         * @param {Object} report
         */
        var ignoredTargetHandler = function (report) {
            var target = targetExists(report.target_village_id)

            if (!target) {
                return false
            }

            ignoreVillage(target)

            return true
        }

        /**
         * Check if the report has full haul and add the target to
         * the priority list.
         *
         * @param {Object} reportInfo
         */
        var priorityHandler = function (reportInfo) {
            getReport(reportInfo.id, function (data) {
                var attack = data.ReportAttack
                var vid = attack.attVillageId
                var tid = attack.defVillageId

                if (!priorityTargets.hasOwnProperty(vid)) {
                    priorityTargets[vid] = []
                }

                if (priorityTargets[vid].includes(tid)) {
                    return false
                }

                priorityTargets[vid].push(tid)

                eventQueue.trigger(eventTypeProvider.FARM_PRIORITY_TARGET_ADDED, {
                    id: tid,
                    name: attack.defVillageName,
                    x: attack.defVillageX,
                    y: attack.defVillageY
                })
            })
        }

        /**
         * Check all delayed priority reports.
         */
        var delayedPriorityHandler = function () {
            reportQueue.forEach(function (report) {
                priorityHandler(report)
            })

            reportQueue = []
        }

        /**
         * Check all attack reports while the farm is running.
         * 
         * @param {Object} data.
         */
        var reportHandler = function (event, data) {
            if (!commander.running || data.type !== 'attack') {
                return false
            }

            // data.result === 1 === 'nocasualties'
            if (settings[SETTINGS.IGNORE_ON_LOSS] && data.result !== 1) {
                ignoredTargetHandler(data)
            }

            if (settings[SETTINGS.PRIORITY_TARGETS] && data.haul === 'full') {
                if (windowManagerService.isTemplateOpen('report')) {
                    reportQueue.push(data)
                } else {
                    priorityHandler(data)
                }
            }
        }

        /**
         * Run all delayed handlers.
         *
         * Some reports are added to the delayed list because
         * the script can't read reports if the the have the 
         * report window opened.
         */
        var delayedReportHandler = function (event, templateName) {
            if (templateName === 'report') {
                delayedPriorityHandler()
            }
        }

        $rootScope.$on(eventTypeProvider.REPORT_NEW, reportHandler)
        $rootScope.$on(eventTypeProvider.WINDOW_CLOSED, delayedReportHandler)
    }

    var messageListener = function () {
        /**
         * Check messages related to the remote controller.
         */
        var remoteHandler = function (event, data) {
            var id = settings[SETTINGS.REMOTE_ID]
            var userMessage

            if (data.participants.length !== 1 || data.title !== id) {
                return false
            }

            userMessage = data.message.content.trim().toLowerCase()

            switch (userMessage) {
            case 'on':
            case 'start':
            case 'init':
            case 'begin':
                farmOverflow.restart()

                sendMessageReply(data.message_id, genStatusReply())
                eventQueue.trigger(eventTypeProvider.FARM_REMOTE_COMMAND, ['on'])

                break
            case 'off':
            case 'stop':
            case 'pause':
            case 'end':
                farmOverflow.pause()

                sendMessageReply(data.message_id, genStatusReply())
                eventQueue.trigger(eventTypeProvider.FARM_REMOTE_COMMAND, ['off'])

                break
            case 'status':
            case 'current':
                sendMessageReply(data.message_id, genStatusReply())
                eventQueue.trigger(eventTypeProvider.FARM_REMOTE_COMMAND, ['status'])

                break
            }

            return false
        }

        $rootScope.$on(eventTypeProvider.MESSAGE_SENT, remoteHandler)
    }

    var presetListener = function () {
        var updatePresetsHandler = function () {
            updatePresets()
            eventQueue.trigger(eventTypeProvider.FARM_PRESETS_CHANGE)

            if (commander.running) {
                var hasPresets = !!selectedPresets.length

                if (hasPresets) {
                    if (globalWaiting) {
                        resetWaitingVillages()
                        farmOverflow.restart()
                    }
                } else {
                    eventQueue.trigger(eventTypeProvider.FARM_NO_PRESET)
                    farmOverflow.pause()
                }
            }
        }

        $rootScope.$on(eventTypeProvider.ARMY_PRESET_UPDATE, updatePresetsHandler)
        $rootScope.$on(eventTypeProvider.ARMY_PRESET_DELETED, updatePresetsHandler)
    }

    var groupListener = function () {
        var groupChangeHandler = function () {
            updateExceptionGroups()
            updateExceptionVillages()

            eventQueue.trigger(eventTypeProvider.FARM_GROUPS_CHANGED)
        }

        /**
         * Detect groups added to villages and update
         * the included villages list.
         */
        var groupLinkHandler = function (event, data) {
            updatePlayerVillages()

            if (!groupInclude.length) {
                return false
            }

            if (groupInclude.includes(data.group_id)) {
                villagesTargets = {}
            }
        }

        $rootScope.$on(eventTypeProvider.GROUPS_UPDATED, groupChangeHandler)
        $rootScope.$on(eventTypeProvider.GROUPS_CREATED, groupChangeHandler)
        $rootScope.$on(eventTypeProvider.GROUPS_DESTROYED, groupChangeHandler)
        $rootScope.$on(eventTypeProvider.GROUPS_VILLAGE_LINKED, groupLinkHandler)
        $rootScope.$on(eventTypeProvider.GROUPS_VILLAGE_UNLINKED, groupLinkHandler)
    }

    var villageListener = function () {
        /**
         * Remove a village from the wait list and restart the
         * cycle if needed.
         */
        var freeVillage = function (vid) {
            delete waitingVillages[vid]

            if (globalWaiting) {
                globalWaiting = false

                if (settings[SETTINGS.STEP_CYCLE]) {
                    return false
                }

                if (commander.running) {
                    selectVillage(vid)
                    commander.analyse()
                }
            }
        }

        /**
         * Detect village army changes and remove the village
         * of the wait list.
         */
        var armyChangeHandler = function (event, data) {
            var vid = data.village_id
            var reason = waitingVillages[vid] || false

            if (reason === 'units' || reason === 'commands') {
                freeVillage(vid)

                return false
            }
        }

        /**
         * Detect village resource changes and add/remove the village
         * from the wait list depending on if the storage is full.
         */
        var resourceChangeHandler = function (event, data) {
            var vid = data.villageId
            var reason = waitingVillages[vid] || false
            var village

            if (reason === WAITING_STATES.FULL_STORAGE) {
                freeVillage(vid)
            } else {
                village = getVillageById(vid)

                if (isFullStorage(village)) {
                    setWaitingVillage(vid, WAITING_STATES.FULL_STORAGE)
                }
            }
        }

        $rootScope.$on(eventTypeProvider.VILLAGE_ARMY_CHANGED, armyChangeHandler)
        $rootScope.$on(eventTypeProvider.VILLAGE_RESOURCES_CHANGED, resourceChangeHandler)
    }

    var generalListeners = function () {
        var reconnectHandler = function () {
            if (commander.running) {
                setTimeout(function () {
                    farmOverflow.restart()
                }, 5000)
            }
        }

        // Load map data when called.
        // Run when the method mapData.loadTownDataAsync is called.
        //
        // Is it still necessary?
        mapData.setRequestFn(function (args) {
            socketService.emit(routeProvider.MAP_GETVILLAGES, args)
        })

        $rootScope.$on(eventTypeProvider.RECONNECT, reconnectHandler)
    }

    var addEventLog = function (data) {
        if (!data) {
            return false
        }

        logs.unshift(data)
        setLogs(logs)
        eventQueue.trigger(eventTypeProvider.FARM_LOGS_UPDATED)
    }

    var bindEvents = function () {
        eventQueue.register(eventTypeProvider.FARM_SEND_COMMAND, function (event, data) {
            updateLastAttack()
            updateCurrentStatus(FARM_STATES.ATTACKING)

            var origin = data[0]
            var target = data[1]

            addEventLog({
                icon: 'attack-small',
                origin: {id: origin.id, coords: `${origin.x}|${origin.y}`},
                target: {id: target.id, coords: `${target.x}|${target.y}`},
                type: LOG_TYPES.ATTACK,
                time: timeHelper.gameTime()
            })
        })

        eventQueue.register(eventTypeProvider.FARM_NEXT_VILLAGE, function (event, village) {
            addEventLog({
                icon: 'village',
                village: {id: village.id, coords: `${village.x}|${village.y}`},
                type: LOG_TYPES.VILLAGE_SWITCH,
                time: timeHelper.gameTime()
            })
        })

        eventQueue.register(eventTypeProvider.FARM_PRIORITY_TARGET_ADDED, function (event, village) {
            addEventLog({
                icon: 'parallel-recruiting',
                type: LOG_TYPES.PRIORITY_TARGET,
                village: {id: village.id, coords: `${village.x}|${village.y}`},
                time: timeHelper.gameTime()
            })
        })

        eventQueue.register(eventTypeProvider.FARM_IGNORED_VILLAGE, function (event, village) {
            addEventLog({
                icon: 'check-negative',
                type: LOG_TYPES.IGNORED_VILLAGE,
                village: {id: village.id, coords: `${village.x}|${village.y}`},
                time: timeHelper.gameTime()
            })
        })

        eventQueue.register(eventTypeProvider.FARM_NO_PRESET, function () {
            updateCurrentStatus(FARM_STATES.PAUSED)

            addEventLog({
                icon: 'village',
                type: LOG_TYPES.NO_PRESET,
                time: timeHelper.gameTime()
            })
        })

        eventQueue.register(eventTypeProvider.FARM_NO_UNITS, function () {
            updateCurrentStatus(FARM_STATES.NO_UNITS)
        })

        eventQueue.register(eventTypeProvider.FARM_NO_UNITS_NO_COMMANDS, function () {
            updateCurrentStatus(FARM_STATES.NO_UNITS_NO_COMMANDS)
        })

        eventQueue.register(eventTypeProvider.FARM_START, function () {
            updateCurrentStatus(FARM_STATES.ATTACKING)
        })

        eventQueue.register(eventTypeProvider.FARM_PAUSE, function () {
            updateCurrentStatus(FARM_STATES.PAUSED)
        })

        eventQueue.register(eventTypeProvider.FARM_LOADING_TARGETS_START, function () {
            updateCurrentStatus(FARM_STATES.LOADING_TARGETS)
        })

        eventQueue.register(eventTypeProvider.FARM_LOADING_TARGETS_END, function () {
            updateCurrentStatus(FARM_STATES.ANALYSE_TARGETS)
        })

        eventQueue.register(eventTypeProvider.FARM_COMMAND_LIMIT_SINGLE, function () {
            updateCurrentStatus(FARM_STATES.COMMAND_LIMIT)
        })

        eventQueue.register(eventTypeProvider.FARM_COMMAND_LIMIT_MULTI, function () {
            updateCurrentStatus(FARM_STATES.NO_VILLAGES)
        })

        eventQueue.register(eventTypeProvider.FARM_STEP_CYCLE_END, function () {
            updateCurrentStatus(FARM_STATES.STEP_CYCLE_END)
        })

        eventQueue.register(eventTypeProvider.FARM_STEP_CYCLE_END_NO_VILLAGES, function () {
            updateCurrentStatus(FARM_STATES.STEP_CYCLE_END_NO_VILLAGES)
        })

        eventQueue.register(eventTypeProvider.FARM_STEP_CYCLE_NEXT, function () {
            updateCurrentStatus(FARM_STATES.STEP_CYCLE_NEXT)
        })

        eventQueue.register(eventTypeProvider.FARM_FULL_STORAGE, function () {
            updateCurrentStatus(FARM_STATES.FULL_STORAGE)
        })
    }

    var updateLastAttack = function () {
        lastAttack = timeHelper.gameTime()
        Lockr.set(STORAGE_ID.LAST_ATTACK, lastAttack)
    }

    var getVillageById = function (vid) {
        var i = playerVillages.indexOf(vid)

        return i !== -1 ? playerVillages[i] : false
    }

    var selectVillage = function (vid) {
        var village = getVillageById(vid)

        if (village) {
            selectedVillage = village

            return true
        }

        return false
    }

    var assignPresets = function (presetIds, callback) {
        socketService.emit(routeProvider.ASSIGN_PRESETS, {
            village_id: selectedVillage.id,
            preset_ids: presetIds
        }, callback)
    }

    /**
     * @param {Object} target
     */
    var ignoreVillage = function (target) {
        if (!groupIgnore) {
            return false
        }

        socketService.emit(routeProvider.GROUPS_LINK_VILLAGE, {
            group_id: groupIgnore,
            village_id: target.id
        }, function () {
            eventQueue.trigger(eventTypeProvider.FARM_IGNORED_VILLAGE, target)
        })
    }

    /**
     * Check if the village is a target of some village
     * being used to farm.
     */
    var targetExists = function (targetId) {
        var vid
        var villageTargets
        var i
        var target

        for (vid in villagesTargets) {
            villageTargets = villagesTargets[vid]

            for (i = 0; i < villageTargets.length; i++) {
                target = villageTargets[i]

                if (target.id === targetId) {
                    return target
                }
            }
        }

        return false
    }

    var resetWaitingVillages = function () {
        waitingVillages = {}
    }

    /*
     * Check if the last attack sent by the farm already is beyond
     * the determined tolerance time. So it can restart the attacks
     * if necessary.
     *
     * This is necessary because sometimes the game stop
     * responding to .emit socket calls and stop the attacks,
     * making the farm freeze in 'started' state.
     *
     * Not sure if it is a problem caused by connection
     * or a internal bug of the game.
     */
    var initPersistentRunning = function () {
        setInterval(function () {
            if (commander.running) {
                var gameTime = timeHelper.gameTime()
                var passedTime = gameTime - lastAttack
                var toleranceTime = PERSISTENT_TOLERANCE

                // If the step cycle setting is enabled, increase
                // the tolerance time with the interval time between
                // the cycles.
                if (settings[SETTINGS.STEP_CYCLE] && cycle.intervalEnabled()) {
                    toleranceTime += (settings[SETTINGS.STEP_CYCLE_INTERVAL] * 60) + (1000 * 60)
                }

                if (passedTime > toleranceTime) {
                    farmOverflow.pause()
                    farmOverflow.start()
                }
            }
        }, PERSISTENT_INTERVAL)
    }

    /**
     * Reset the target list everytime avoiding attack to villages
     * conquered by other players.
     */
    var initTargetsProof = function () {
        setInterval(function () {
            villagesTargets = {}
        }, TARGETS_RELOAD_TIME)
    }

    var getReport = function (reportId, callback) {
        socketService.emit(routeProvider.REPORT_GET, {
            id: reportId
        }, callback)
    }

    var sendMessageReply = function (message_id, message) {
        socketService.emit(routeProvider.MESSAGE_REPLY, {
            message_id: message_id,
            message: message
        })
    }

    /**
     * Generate the message body for the remote control messages.
     *
     * @return {String}
     */
    var genStatusReply = function () {
        var localeStatus = $filter('i18n')('status', $rootScope.loc.ale, textObjectCommon)
        var localeVillage = $filter('i18n')('selected_village', $rootScope.loc.ale, textObject)
        var localeLast = $filter('i18n')('last_attack', $rootScope.loc.ale, textObject)
        var statusReplace = null
        var next
        var farmStatus
        var villageLabel = utils.genVillageLabel(selectedVillage)
        var last = utils.formatDate(lastAttack)
        var vid = selectedVillage.id
        var message = []

        if (currentStatus === FARM_STATES.STEP_CYCLE_NEXT) {
            next = timeHelper.gameTime() + (settings[SETTINGS.STEP_CYCLE_INTERVAL] * 60)
            statusReplace = utils.formatDate(next)
        }

        farmStatus = $filter('i18n')(currentStatus, $rootScope.loc.ale, textObject, statusReplace)
        
        message.push(`[b]${localeStatus}:[/b] ${farmStatus}[br]`)
        message.push(`[b]${localeVillage}:[/b] `)
        message.push(`[village=${vid}]${villageLabel}[/village][br]`)
        message.push(`[b]${localeLast}:[/b] ${last}`)

        return message.join('')
    }

    /**
     * Check if the farm was idle for a determited period of time.
     *
     * @return {Boolean}
     */
    var isExpiredData = function () {
        var now = timeHelper.gameTime()
        var cycleInterval = settings[SETTINGS.STEP_CYCLE_INTERVAL] * 60

        if (settings[SETTINGS.STEP_CYCLE] && cycle.intervalEnabled()) {
            if (now > (lastActivity + cycleInterval + (60 * 1000))) {
                return true
            }
        } else if (now > lastActivity + DATA_EXPIRE_TIME) {
            return true
        }

        return false
    }

    /**
     * @param {Number} x - X-coord.
     * @param {Number} y - Y-coord.
     * @param {Number} w - Width. Limit: 50
     * @param {Number} h - Height. Limit: 50
     * @param {Function} callback
     */
    var loadMapSectors = function (x, y, w, h, chunk, callback) {
        var sectors
        var loads
        var length
        var index

        if (mapData.hasTownDataInChunk(x, y)) {
            sectors = mapData.loadTownData(x, y, w, h, chunk)

            return callback(sectors)
        }

        eventQueue.trigger(eventTypeProvider.FARM_LOADING_TARGETS_START)

        loads = convert.scaledGridCoordinates(x, y, w, h, chunk)
        length = loads.length
        index = 0

        mapData.loadTownDataAsync(x, y, w, h, function () {
            if (++index === length) {
                eventQueue.trigger(eventTypeProvider.FARM_LOADING_TARGETS_END)
                sectors = mapData.loadTownData(x, y, w, h, chunk)

                callback(sectors)
            }
        })
    }

    /**
     * @param {Number} sectors
     * @return {Array} List of all sector villages.
     */
    var parseMapSector = function (sectors) {
        var i = sectors.length
        var villages = []
        var sector
        var sectorDataX
        var sx
        var sectorDataY
        var sy
        var village

        while (i--) {
            sector = sectors[i]
            sectorDataX = sector.data

            for (sx in sectorDataX) {
                sectorDataY = sectorDataX[sx]

                for (sy in sectorDataY) {
                    village = sectorDataY[sy]
                    villages.push(village)
                }
            }
        }

        return villages
    }

    var filterTargets = function (targets) {
        return targets.filter(function (target) {
            return mapFilters.every(function (fn) {
                return !fn(target)
            })
        })
    }

    /**
     * Convert the village in objects with only the necessary data.
     * 
     * @param {Array} targets
     * @return {Array}.
     */
    var parseTargets = function (targets) {
        var processedTargets = []
        var origin = selectedVillage.position
        var target
        var i

        for (i = 0; i < targets.length; i++) {
            target = targets[i]
            
            processedTargets.push({
                x: target.x,
                y: target.y,
                distance: math.actualDistance(origin, target),
                id: target.id,
                name: target.name,
                pid: target.character_id
            })
        }

        return processedTargets
    }

    /**
     * Load the local settings and merge with the defaults.
     */
    var loadSettings = function () {
        var localSettings = Lockr.get(STORAGE_ID.SETTINGS, {}, true)
        var key

        for (key in SETTINGS_MAP) {
            settings[key] = localSettings.hasOwnProperty(key)
                ? localSettings[key]
                : SETTINGS_MAP[key].default
        }
    }

    var updateCurrentStatus = function (status) {
        currentStatus = status
        eventQueue.trigger(eventTypeProvider.FARM_STATUS_CHANGE, status)
    }

    var getFreeVillages = function () {
        return playerVillages.filter(function (village) {
            if (waitingVillages[village.id]) {
                return false
            } else if (settings[SETTINGS.IGNORE_FULL_STORAGE]) {
                if (isFullStorage(village)) {
                    waitingVillages[village.id] = WAITING_STATES.FULL_STORAGE
                    return false
                }
            }

            return true
        })
    }

    var setWaitingVillage = function (id, _reason) {
        waitingVillages[id] = _reason || true
    }

    var setLogs = function (newLogs) {
        if (newLogs.length > settings[SETTINGS.LOGS_LIMIT]) {
            newLogs = newLogs.slice(0, settings[SETTINGS.LOGS_LIMIT])
        }

        logs = newLogs
        Lockr.set(STORAGE_ID.LOGS, logs)
    }

    var isFullStorage = function (_village) {
        var village = _village || selectedVillage
        var resources
        var computed
        var maxStorage

        if (village.original.isReady()) {
            resources = village.original.getResources()
            computed = resources.getComputed()
            maxStorage = resources.getMaxStorage()

            return ['wood', 'clay', 'iron'].every(function (res) {
                return computed[res].currentStock === maxStorage
            })
        }

        return false
    }

    var createCommander = function () {
        commander = new Commander()
    }

    /**
     * Stop commander without stopping the whole farm.
     */
    var breakCommander = function () {
        clearTimeout(commander.timeoutId)
        commander.running = false
    }

    var updateActivity = function () {
        lastActivity = timeHelper.gameTime()
        Lockr.set(STORAGE_ID.LAST_ACTIVITY, lastActivity)
    }

    /**
     * @param {Boolean=} _selectOnly - Only select the current target.
     */
    var nextTarget = function (_selectOnly) {
        var sid = selectedVillage.id
        var villageTargets
        var priorityId
        var i
        var index
        var changed
        var target

        if (!villagesTargets[sid]) {
            commander.analyse()

            return false
        }

        villageTargets = villagesTargets[sid]

        if (settings[SETTINGS.PRIORITY_TARGETS] && priorityTargets[sid]) {
            priorityId

            while (priorityId = priorityTargets[sid].shift()) {
                if (ignoredVillages.includes(priorityId)) {
                    continue
                }

                for (i = 0; i < villageTargets.length; i++) {
                    if (villageTargets[i].id === priorityId) {
                        selectedTarget = villageTargets[i]

                        return true
                    }
                }
            }
        }

        index = targetIndexes[sid]
        changed = false

        if (!_selectOnly) {
            index = ++targetIndexes[sid]
        }

        for (; index < villageTargets.length; index++) {
            target = villageTargets[index]

            if (ignoredVillages.includes(target.id)) {
                eventQueue.trigger(eventTypeProvider.FARM_IGNORED_TARGET, [target])

                continue
            }

            selectedTarget = target
            changed = true

            break
        }

        if (changed) {
            targetIndexes[sid] = index
        } else {
            selectedTarget = villageTargets[0]
            targetIndexes[sid] = 0
        }

        Lockr.set(STORAGE_ID.INDEXES, targetIndexes)

        return true
    }

    var hasTarget = function () {
        var sid = selectedVillage.id
        var index = targetIndexes[sid]
        var targets = villagesTargets[sid]

        if (!targets.length) {
            return false
        }

        // Check if the index was not reseted by idleness.
        // Check if the target in the index exists. Happens when
        // the number of targets is reduced by settings when
        // the farm is not running.
        if (index === undefined || index > targets.length) {
            targetIndexes[sid] = index = 0
        }

        return !!targets[index]
    }

    var getTargets = function (callback) {
        var origin = selectedVillage.position
        var sid = selectedVillage.id
        var chunk = conf.MAP_CHUNK_SIZE
        var x = origin.x - chunk
        var y = origin.y - chunk
        var w = chunk * 2
        var h = chunk * 2
        var listedTargets
        var filteredTargets
        var processedTargets
        var hasVillages

        if (sid in villagesTargets) {
            return callback()
        }

        loadMapSectors(x, y, w, h, chunk, function (sectors) {
            listedTargets = parseMapSector(sectors)
            filteredTargets = filterTargets(listedTargets)
            processedTargets = parseTargets(filteredTargets)

            if (processedTargets.length === 0) {
                hasVillages = nextVillage()

                if (hasVillages) {
                    getTargets(callback)
                } else {
                    eventQueue.trigger(eventTypeProvider.FARM_NO_TARGETS)
                }

                return false
            }

            villagesTargets[sid] = processedTargets.sort(function (a, b) {
                return a.distance - b.distance
            })

            if (targetIndexes.hasOwnProperty(sid)) {
                if (targetIndexes[sid] > villagesTargets[sid].length) {
                    targetIndexes[sid] = 0

                    Lockr.set(STORAGE_ID.INDEXES, targetIndexes)
                }
            } else {
                targetIndexes[sid] = 0

                Lockr.set(STORAGE_ID.INDEXES, targetIndexes)
            }

            callback()
        })
    }

    var nextVillage = function () {
        var next
        var availVillage

        if (singleVillage) {
            return false
        }

        if (settings[SETTINGS.STEP_CYCLE]) {
            return cycle.nextVillage()
        }

        if (next = leftVillages.shift()) {
            availVillage = getFreeVillages().some(function (freeVillage) {
                return freeVillage.id === next.id
            })

            if (availVillage) {
                selectedVillage = next
                eventQueue.trigger(eventTypeProvider.FARM_NEXT_VILLAGE, selectedVillage)
                updateActivity()

                return true
            } else {
                return nextVillage()
            }
        } else {
            leftVillages = getFreeVillages()

            if (leftVillages.length) {
                return nextVillage()
            }

            if (singleVillage) {
                eventQueue.trigger(eventTypeProvider.FARM_NO_UNITS)
            } else {
                eventQueue.trigger(eventTypeProvider.FARM_NO_VILLAGES)
            }

            return false
        }
    }

    var checkPresets = function (callback) {
        if (!selectedPresets.length) {
            farmOverflow.pause()
            eventQueue.trigger(eventTypeProvider.FARM_NO_PRESET)

            return false
        }

        var vid = selectedVillage.id
        var villagePresets = modelDataService.getPresetList().getPresetsByVillageId(vid)
        var needAssign = false
        var which = []
        var id

        selectedPresets.forEach(function (preset) {
            if (!villagePresets.hasOwnProperty(preset.id)) {
                needAssign = true
                which.push(preset.id)
            }
        })

        if (needAssign) {
            for (id in villagePresets) {
                which.push(id)
            }

            assignPresets(which, callback)
        } else {
            callback()
        }
    }

    var targetsLoaded = function () {
        return villagesTargets.hasOwnProperty(selectedVillage.id)
    }

    var isWaiting = function () {
        return waitingVillages.hasOwnProperty(selectedVillage.id)
    }

    var isIgnored = function () {
        return ignoredVillages.includes(selectedVillage.id)
    }

    var isAllWaiting = function () {
        var i
        var vid

        for (i = 0; i < playerVillages.length; i++) {
            vid = playerVillages[i].id

            if (!waitingVillages.hasOwnProperty(vid)) {
                return false
            }
        }

        return true
    }

    var Commander = (function () {
        var lastCommand = false

        /**
         * Control the cycle of commands, sending attacks, changing village and targets.
         */
        function Commander () {
            /**
             * Store the next event (no_units/command_limit) to prevent the execution
             * of the next command.
             * Needed because the internal values of the game do not sync with the server,
             * causing errors like no_units/command_limit.
             * 
             * @type {String|Boolean}
             */
            this.preventNextCommand = false

            /**
             * Timeout id used on interval of each attack.
             * Needed to stop delayed attacks when the farm is manually stopped.
             * 
             * @type {Number}
             */
            this.timeoutId = null

            /**
             * @type {Boolean}
             */
            this.running = false

            return this
        }

        Commander.prototype.analyse = function () {
            var preset

            if (!this.running) {
                return
            }

            if (!selectedPresets.length) {
                farmOverflow.pause()
                eventQueue.trigger(eventTypeProvider.FARM_NO_PRESET)

                return
            }

            if (!selectedVillage) {
                return eventQueue.trigger(eventTypeProvider.FARM_NO_VILLAGE_SELECTED)
            }

            if (!selectedVillage.loaded()) {
                selectedVillage.load(() => {
                    this.analyse()
                })

                return
            }

            if (isWaiting() || isIgnored()) {
                if (nextVillage()) {
                    this.analyse()
                } else {
                    eventQueue.trigger(lastError)
                }

                return
            }

            if (settings[SETTINGS.IGNORE_FULL_STORAGE] && isFullStorage()) {
                if (nextVillage()) {
                    this.analyse()
                } else {
                    this.handleError(ERROR_TYPES.FULL_STORAGE)
                }

                return
            }

            if (!targetsLoaded()) {
                return getTargets(() => {
                    this.analyse()
                })
            }

            if (hasTarget()) {
                nextTarget(true)
            } else {
                if (nextVillage()) {
                    this.analyse()
                } else {
                    eventQueue.trigger(eventTypeProvider.FARM_NO_TARGETS)
                }

                return
            }

            checkPresets(() => {
                if (selectedVillage.countCommands() >= settings[SETTINGS.COMMANDS_PER_VILLAGE]) {
                    return this.handleError(ERROR_TYPES.COMMAND_LIMIT)
                }

                preset = this.getPreset()

                if (preset.error) {
                    return this.handleError(preset.error)
                }

                this.getPresetNext(preset)
                this.send(preset)
            })
        }

        /**
         * @param {String} error - error id
         */
        Commander.prototype.handleError = function (error) {
            lastError = error || this.preventNextCommand
            this.preventNextCommand = false

            var sid = selectedVillage.id
            var singleVillage
            var allWaiting
            var eventType

            switch (lastError) {
            case ERROR_TYPES.TIME_LIMIT:
                nextTarget()
                this.analyse()

                break
            case ERROR_TYPES.NO_UNITS:
                eventQueue.trigger(eventTypeProvider.FARM_NO_UNITS, [selectedVillage])
                setWaitingVillage(sid, WAITING_STATES.UNITS)

                if (singleVillage) {
                    if (selectedVillage.countCommands() === 0) {
                        eventQueue.trigger(eventTypeProvider.FARM_NO_UNITS_NO_COMMANDS)
                    } else {
                        globalWaiting = true

                        if (settings[SETTINGS.STEP_CYCLE]) {
                            cycle.endStep()
                        }
                    }

                    return
                }

                if (nextVillage()) {
                    this.analyse()
                } else {
                    globalWaiting = true
                }

                break
            case ERROR_TYPES.COMMAND_LIMIT:
                setWaitingVillage(sid, WAITING_STATES.COMMANDS)

                allWaiting = isAllWaiting()

                if (singleVillage || allWaiting) {
                    eventType = singleVillage
                        ? eventTypeProvider.FARM_COMMAND_LIMIT_SINGLE
                        : eventTypeProvider.FARM_COMMAND_LIMIT_MULTI

                    eventQueue.trigger(eventType, [selectedVillage])
                    globalWaiting = true

                    if (settings[SETTINGS.STEP_CYCLE]) {
                        return cycle.endStep()
                    }
                }

                nextVillage()
                this.analyse()

                break
            case ERROR_TYPES.FULL_STORAGE:
                setWaitingVillage(sid, WAITING_STATES.FULL_STORAGE)

                if (singleVillage) {
                    globalWaiting = true

                    if (settings[SETTINGS.STEP_CYCLE]) {
                        return cycle.endStep()
                    }

                    eventQueue.trigger(eventTypeProvider.FARM_FULL_STORAGE)
                }

                break
            }
        }

        /**
         * Get the preset with enough units and with the limits of the max time travel.
         *
         * @param {Object} [_units] Analyse these units instead of the units of the
         *                          selected village.
         * @return {Object} preset or error.
         */
        Commander.prototype.getPreset = function (_units) {
            var timeLimit = false
            var units = _units || selectedVillage.units
            var selectedPreset = false
            var avail
            var unit
            
            selectedPresets.forEach((preset) => {
                if (selectedPreset) {
                    return false
                }

                avail = true

                for (unit in preset.units) {
                    if (units[unit].in_town < preset.units[unit]) {
                        avail = false
                    }
                }

                if (avail) {
                    if (this.checkPresetTime(preset)) {
                        selectedPreset = preset
                    } else {
                        timeLimit = true
                    }
                }
            })

            if (selectedPreset) {
                return selectedPreset
            }

            return {
                error: timeLimit ? ERROR_TYPES.TIME_LIMIT : ERROR_TYPES.NO_UNITS
            }
        }

        /**
         * Verifica a condição das tropas na aldeia do proximo comando.
         * Beforehand check the conditions of the units of the village of the
         * next command.
         *
         * @param {Object} presetUsed
         */
        Commander.prototype.getPresetNext = function (presetUsed) {
            var unitsCopy = angular.copy(selectedVillage.units)
            var unitsUsed = presetUsed.units
            var unit
            var result

            for (unit in unitsUsed) {
                unitsCopy[unit].in_town -= unitsUsed[unit]
            }

            result = this.getPreset(unitsCopy)

            if (result.error) {
                this.preventNextCommand = result.error
            }
        }

        /**
         * Check if the preset's travel time of the origin village all the way to
         * the target do not get max time travel setting.
         *
         * @param {Object} preset
         */
        Commander.prototype.checkPresetTime = function (preset) {
            var limitTime = settings[SETTINGS.MAX_TRAVEL_TIME] * 60
            var villagePosition = selectedVillage.position
            var distance = math.actualDistance(villagePosition, selectedTarget)
            var travelTime = armyService.calculateTravelTime(preset, {
                barbarian: !selectedTarget.pid,
                officers: false
            })
            var totalTravelTime = armyService.getTravelTimeForDistance(
                preset,
                travelTime,
                distance,
                'attack'
            )

            return limitTime > totalTravelTime
        }

        /**
         * @param {Object} preset
         * @param {Function} callback
         */
        Commander.prototype.send = function (preset, callback) {
            var now = Date.now()
            var unbindError
            var unbindSend
            var interval

            if (lastCommand && now - lastCommand < 100) {
                return false
            } else {
                lastCommand = now
            }

            if (!this.running) {
                return false
            }

            this.simulate()

            // For some reason the list of commands of some villages
            // do not sync with the commands registered on the server,
            // so we check by ourselves and update the local commands
            // if needed and restart the analyses.
            unbindError = this.onCommandError(() => {
                unbindSend()

                selectedVillage.updateCommands(() => {
                    this.analyse()
                })
            })

            unbindSend = this.onCommandSend(() => {
                unbindError()
                nextTarget()

                // Minimum of 1 second to allow the interval values get updated.
                interval = utils.randomSeconds(settings[SETTINGS.RANDOM_BASE])
                interval = 100 + (interval * 1000)

                this.timeoutId = setTimeout(() => {
                    if (this.preventNextCommand) {
                        return this.handleError()
                    }

                    this.analyse()
                }, interval)

                updateActivity()
            })

            socketService.emit(routeProvider.SEND_PRESET, {
                start_village: selectedVillage.id,
                target_village: selectedTarget.id,
                army_preset_id: preset.id,
                type: 'attack'
            })

            return true
        }

        /**
         * Called after the confirmation of units changing on the village.
         */
        Commander.prototype.onCommandSend = function (callback) {
            var before = angular.copy(selectedVillage.units)
            var now
            var equals
            var unbind = $rootScope.$on(eventTypeProvider.VILLAGE_UNIT_INFO, function (event, data) {
                if (selectedVillage.id !== data.village_id) {
                    return false
                }

                now = selectedVillage.units
                equals = angular.equals(before, now)

                if (equals) {
                    return false
                }

                eventQueue.trigger(eventTypeProvider.FARM_SEND_COMMAND, [
                    selectedVillage,
                    selectedTarget
                ])

                unbind()
                callback()
            })

            return unbind
        }

        /**
         * Called after an error when trying to send a command.
         */
        Commander.prototype.onCommandError = function (callback) {
            var unbind = $rootScope.$on(eventTypeProvider.MESSAGE_ERROR, function (event, data) {
                if (!data.cause || !data.code) {
                    return false
                }

                if (data.cause !== 'Command/sendPreset') {
                    return false
                }

                if (data.code !== 'Command/attackLimitExceeded') {
                    return false
                }

                eventQueue.trigger(eventTypeProvider.FARM_SEND_COMMAND_ERROR, [data.code])

                unbind()
                callback()
            })

            return unbind
        }

        /**
         * Simulate some requisitions made by the game when commands
         * are sent manually.
         *
         * @param {Function} callback
         */
        Commander.prototype.simulate = function (callback) {
            var attackingFactor = function () {
                socketService.emit(routeProvider.GET_ATTACKING_FACTOR, {
                    target_id: selectedTarget.id
                })
            }

            attackingFactor()

            if (callback) {
                callback()
            }
        }

        return Commander
    })()

    var cycle = (function () {
        var villageList = []

        /**
         * Used to avoid sendind attacks after the farm being
         * manually stopped.
         * 
         * @type {Number}
         */
        var timeoutId = null

        /**
         * Exported object.
         */
        var cycle = {}

        cycle.intervalEnabled = function () {
            return !!settings[SETTINGS.STEP_CYCLE_INTERVAL]
        }

        cycle.startContinuous = function (_manual) {
            commander = new Commander()
            commander.running = true

            eventQueue.trigger(eventTypeProvider.FARM_START, _manual)

            if (!getFreeVillages().length) {
                if (singleVillage) {
                    if (isFullStorage()) {
                        eventQueue.trigger(eventTypeProvider.FARM_FULL_STORAGE)
                    } else {
                        eventQueue.trigger(eventTypeProvider.FARM_NO_UNITS)
                    }
                } else {
                    eventQueue.trigger(eventTypeProvider.FARM_NO_VILLAGES)
                }

                return
            }

            leftVillages = getFreeVillages()
            commander.analyse()
        }

        /**
         * The step cycle mode use all available villages only one time.
         *
         * @param  {Boolean} _manual - if true, the restart notification will
         *      not show.
         */
        cycle.startStep = function (_manual) {
            var freeVillages = getFreeVillages()

            commander = new Commander()
            commander.running = true
            
            eventQueue.trigger(eventTypeProvider.FARM_START, _manual)

            if (freeVillages.length === 0) {
                eventQueue.trigger(eventTypeProvider.FARM_STEP_CYCLE_NEXT_NO_VILLAGES)

                if (cycle.intervalEnabled()) {
                    cycle.setNextCycle()
                } else {
                    farmOverflow.pause(_manual)
                }

                return
            }

            if (!_manual) {
                eventQueue.trigger(eventTypeProvider.FARM_STEP_CYCLE_RESTART)
            }

            villageList = freeVillages
            commander.analyse()
        }

        cycle.endStep = function () {
            if (cycle.intervalEnabled()) {
                eventQueue.trigger(eventTypeProvider.FARM_STEP_CYCLE_NEXT)
                breakCommander()
                cycle.setNextCycle()
            } else {
                eventQueue.trigger(eventTypeProvider.FARM_STEP_CYCLE_END)
                farmOverflow.pause()
            }

            return false
        }

        cycle.setNextCycle = function () {
            timeoutId = setTimeout(function () {
                cycle.startStep()
            }, settings[SETTINGS.STEP_CYCLE_INTERVAL] * 60)
        }

        cycle.nextVillage = function () {
            var next = villageList.shift()
            var availVillage

            if (next) {
                availVillage = getFreeVillages().some(function (free) {
                    return free.id === next.id
                })

                if (!availVillage) {
                    return cycle.nextVillage()
                }
            } else {
                return cycle.endStep()
            }

            selectedVillage = next
            eventQueue.trigger(eventTypeProvider.FARM_NEXT_VILLAGE, next)

            return true
        }

        cycle.getTimeoutId = function () {
            return timeoutId
        }

        return cycle
    })()

    var farmOverflow = {}

    farmOverflow.init = function () {
        initialized = true
        $player = modelDataService.getSelectedCharacter()
        $gameState = modelDataService.getGameState()
        logs = Lockr.get(STORAGE_ID.LOGS, [], true)
        lastActivity = Lockr.get(STORAGE_ID.LAST_ACTIVITY, timeHelper.gameTime(), true)
        lastAttack = Lockr.get(STORAGE_ID.LAST_ATTACK, -1, true)
        targetIndexes = Lockr.get(STORAGE_ID.INDEXES, {}, true)
        commander = new Commander()
        loadSettings()
        updateExceptionGroups()
        updateExceptionVillages()
        updatePlayerVillages()
        updatePresets()
        reportListener()
        messageListener()
        groupListener()
        presetListener()
        villageListener()
        generalListeners()
        bindEvents()
        initPersistentRunning()
        initTargetsProof()
    }

    farmOverflow.start = function (_manual) {
        if (!selectedPresets.length) {
            eventQueue.trigger(eventTypeProvider.FARM_ERROR, [ERROR_TYPES.PRESET_FIRST, _manual])
            return ERROR_TYPES.PRESET_FIRST
        }

        if (!selectedVillage) {
            eventQueue.trigger(eventTypeProvider.FARM_ERROR, ERROR_TYPES.NO_SELECTED_VILLAGE, _manual)
            return ERROR_TYPES.NO_SELECTED_VILLAGE
        }

        if (!$gameState.getGameState(GAME_STATES.ALL_VILLAGES_READY)) {
            var unbind = $rootScope.$on(eventTypeProvider.GAME_STATE_ALL_VILLAGES_READY, function () {
                unbind()
                farmOverflow.start(_manual)
            })

            return false
        }

        if (isExpiredData()) {
            priorityTargets = {}
            targetIndexes = {}
        }

        if (settings[SETTINGS.STEP_CYCLE]) {
            cycle.startStep(_manual)
        } else {
            cycle.startContinuous(_manual)
        }

        updateActivity()

        return true
    }

    farmOverflow.pause = function (_manual) {
        breakCommander()

        eventQueue.trigger(eventTypeProvider.FARM_PAUSE, _manual)
        clearTimeout(cycle.getTimeoutId())

        return true
    }

    farmOverflow.restart = function (_manual) {
        farmOverflow.pause(_manual)
        farmOverflow.start(_manual)
    }

    farmOverflow.switchState = function (_manual) {
        if (commander.running) {
            farmOverflow.pause(_manual)
        } else {
            farmOverflow.start(_manual)
        }
    }

    /**
     * Update the internal settings and reload the necessary
     * information.
     *
     * @param {Object} changes
     */
    farmOverflow.updateSettings = function (changes) {
        var modify = {}
        var settingMap
        var newValue
        var vid
        var key

        for (key in changes) {
            settingMap = SETTINGS_MAP[key]
            newValue = changes[key]

            if (!settingMap || newValue === settings[key]) {
                continue
            }

            settingMap.updates.forEach(function (modifier) {
                modify[modifier] = true
            })

            settings[key] = newValue
        }

        Lockr.set(STORAGE_ID.SETTINGS, settings)

        if (modify[SETTINGS_UPDATE.GROUPS]) {
            updateExceptionGroups()
            updateExceptionVillages()
        }

        if (modify[SETTINGS_UPDATE.VILLAGES]) {
            updatePlayerVillages()
        }

        if (modify[SETTINGS_UPDATE.PRESET]) {
            updatePresets()
            resetWaitingVillages()
        }

        if (modify[SETTINGS_UPDATE.TARGETS]) {
            villagesTargets = {}
        }

        if (modify[SETTINGS_UPDATE.LOGS]) {
            // used to slice the event list in case the limit of logs
            // have been reduced.
            setLogs(logs)
            eventQueue.trigger(eventTypeProvider.FARM_RESET_LOGS)
        }

        if (modify[SETTINGS_UPDATE.FULL_STORAGE]) {
            for (vid in waitingVillages) {
                if (waitingVillages[vid] === WAITING_STATES.FULL_STORAGE) {
                    delete waitingVillages[vid]
                }
            }
        }

        if (modify[SETTINGS_UPDATE.WAITING_VILLAGES]) {
            for (vid in waitingVillages) {
                if (waitingVillages[vid] === WAITING_STATES.COMMANDS) {
                    delete waitingVillages[vid]
                }
            }
        }

        if (commander.running) {
            farmOverflow.restart()
        }

        eventQueue.trigger(eventTypeProvider.FARM_SETTINGS_CHANGE, [modify])

        return true
    }

    farmOverflow.isInitialized = function () {
        return initialized
    }

    farmOverflow.isRunning = function () {
        return !!commander.running
    }

    farmOverflow.getLogs = function () {
        return logs
    }

    farmOverflow.clearLogs = function () {
        logs = []
        Lockr.set(STORAGE_ID.LOGS, logs)
        eventQueue.trigger(eventTypeProvider.FARM_LOGS_RESETED)
    }

    farmOverflow.getSelectedVillage = function () {
        return selectedVillage
    }

    farmOverflow.getLastAttack = function () {
        return lastAttack
    }

    farmOverflow.getCurrentStatus = function () {
        return currentStatus
    }

    farmOverflow.getSettings = function () {
        return settings
    }

    return farmOverflow
})

define('two/farm/errorTypes', [], function () {
    return {
        TIME_LIMIT: 'time_limit',
        COMMAND_LIMIT: 'command_limit',
        FULL_STORAGE: 'full_storage',
        NO_UNITS: 'no_units',
        PRESET_FIRST: 'preset_first',
        NO_SELECTED_VILLAGE: 'no_selected_village'
    }
})

define('two/farm/Events', [], function () {
    angular.extend(eventTypeProvider, {
        FARM_NO_PRESET: 'farmoverflow_no_preset',
        FARM_NO_VILLAGE_SELECTED: 'farmoverflow_no_village_selected',
        FARM_NO_TARGETS: 'farmoverflow_no_targets',
        FARM_NO_UNITS: 'farmoverflow_no_units',
        FARM_NO_UNITS_NO_COMMANDS: 'farmoverflow_no_units_no_commands',
        FARM_COMMAND_LIMIT_SINGLE: 'farmoverflow_command_limit_single',
        FARM_COMMAND_LIMIT_MULTI: 'farmoverflow_command_limit_multi',
        FARM_FULL_STORAGE: 'farmoverflow_full_storage',
        FARM_SEND_COMMAND: 'farmoverflow_send_command',
        FARM_SEND_COMMAND_ERROR: 'farmoverflow_send_command_error',
        FARM_VILLAGES_UPDATE: 'farmoverflow_villages_update',
        FARM_PRESETS_LOADED: 'farmoverflow_presets_loaded',
        FARM_PRIORITY_TARGET_ADDED: 'farmoverflow_priority_target_added',
        FARM_REMOTE_COMMAND: 'farmoverflow_remote_command',
        FARM_PRESETS_CHANGE: 'farmoverflow_presets_change',
        FARM_GROUPS_CHANGED: 'farmoverflow_groups_changed',
        FARM_LOGS_UPDATED: 'farmoverflow_logs_updated',
        FARM_LOGS_RESETED: 'farmoverflow_logs_reseted',
        FARM_IGNORED_VILLAGE: 'farmoverflow_ignored_village',
        FARM_LOADING_TARGETS_START: 'farmoverflow_loading_targets_start',
        FARM_LOADING_TARGETS_END: 'farmoverflow_loading_targets_end',
        FARM_STATUS_CHANGE: 'farmoverflow_status_change',
        FARM_START: 'farmoverflow_start',
        FARM_PAUSE: 'farmoverflow_pause',
        FARM_RESET_LOGS: 'farmoverflow_reset_logs',
        FARM_SETTINGS_CHANGE: 'farmoverflow_settings_change',
        FARM_IGNORED_TARGET: 'farmoverflow_ignored_target',
        FARM_NEXT_VILLAGE: 'farmoverflow_next_village',
        FARM_NO_VILLAGES: 'farmoverflow_no_villages',
        FARM_STEP_CYCLE_RESTART: 'farmoverflow_step_cycle_restart',
        FARM_STEP_CYCLE_START: 'farmoverflow_step_cycle_start',
        FARM_STEP_CYCLE_END: 'farmoverflow_step_cycle_end',
        FARM_STEP_CYCLE_NEXT: 'farmoverflow_step_cycle_next',
        FARM_STEP_CYCLE_NEXT_NO_VILLAGES: 'farmoverflow_step_cycle_next_no_villages',
        FARM_STEP_CYCLE_END_NO_VILLAGES: 'farmoverflow_step_cycle_end_no_villages',
        FARM_ERROR: 'farmoverflow_error'
    })
})

define('two/farm/logTypes', [], function () {
    return {
        ATTACK: 'attack',
        VILLAGE_SWITCH: 'village_switch',
        NO_PRESET: 'no_preset',
        PRIORITY_TARGET: 'priority_target',
        IGNORED_VILLAGE: 'ignored_village'
    }
})

define('two/farm/settingsMap', [
    'two/farm/settings',
    'two/farm/settingsUpdate'
], function (
    SETTINGS,
    SETTINGS_UPDATE
) {
    return {
        [SETTINGS.PRESETS]: {
            default: [],
            updates: [SETTINGS_UPDATE.PRESET]
        },
        [SETTINGS.GROUP_IGNORE]: {
            default: false,
            updates: [SETTINGS_UPDATE.GROUPS]
        },
        [SETTINGS.GROUP_INCLUDE]: {
            default: [],
            updates: [SETTINGS_UPDATE.GROUPS, SETTINGS_UPDATE.TARGETS]
        },
        [SETTINGS.GROUP_ONLY]: {
            default: [],
            updates: [SETTINGS_UPDATE.GROUPS, SETTINGS_UPDATE.VILLAGES, SETTINGS_UPDATE.TARGETS]
        },
        [SETTINGS.RANDOM_BASE]: {
            default: 3,
            updates: []
        },
        [SETTINGS.COMMANDS_PER_VILLAGE]: {
            default: 48,
            updates: [SETTINGS_UPDATE.WAITING_VILLAGES]
        },
        [SETTINGS.PRIORITY_TARGETS]: {
            default: true,
            updates: []
        },
        [SETTINGS.IGNORE_ON_LOSS]: {
            default: true,
            updates: []
        },
        [SETTINGS.IGNORE_FULL_STORAGE]: {
            default: true,
            updates: [SETTINGS_UPDATE.FULL_STORAGE]
        },
        [SETTINGS.STEP_CYCLE]: {
            default: false,
            updates: [SETTINGS_UPDATE.VILLAGES]
        },
        [SETTINGS.STEP_CYCLE_NOTIFS]: {
            default: false,
            updates: []
        },
        [SETTINGS.STEP_CYCLE_INTERVAL]: {
            default: 0,
            updates: []
        },
        [SETTINGS.MAX_DISTANCE]: {
            default: 10,
            updates: [SETTINGS_UPDATE.TARGETS]
        },
        [SETTINGS.MIN_DISTANCE]: {
            default: 0,
            updates: [SETTINGS_UPDATE.TARGETS]
        },
        [SETTINGS.MIN_POINTS]: {
            default: 0,
            updates: [SETTINGS_UPDATE.TARGETS]
        },
        [SETTINGS.MAX_POINTS]: {
            default: 12500,
            updates: [SETTINGS_UPDATE.TARGETS]
        },
        [SETTINGS.MAX_TRAVEL_TIME]: {
            default: 60,
            updates: []
        },
        [SETTINGS.LOGS_LIMIT]: {
            default: 500,
            updates: [SETTINGS_UPDATE.LOGS]
        },
        [SETTINGS.EVENT_ATTACK]: {
            default: true,
            updates: [SETTINGS_UPDATE.LOGS]
        },
        [SETTINGS.EVENT_VILLAGE_CHANGE]: {
            default: true,
            updates: [SETTINGS_UPDATE.LOGS]
        },
        [SETTINGS.EVENT_PRIORITY_ADD]: {
            default: true,
            updates: [SETTINGS_UPDATE.LOGS]
        },
        [SETTINGS.EVENT_IGNORED_VILLAGE]: {
            default: true,
            updates: [SETTINGS_UPDATE.LOGS]
        },
        [SETTINGS.REMOTE_ID]: {
            default: 'remote',
            updates: []
        },
        [SETTINGS.HOTKEY_SWITCH]: {
            default: 'shift+z',
            updates: []
        },
        [SETTINGS.HOTKEY_WINDOW]: {
            default: 'z',
            updates: []
        }
    }
})

define('two/farm/settingsUpdate', function () {
    return {
        PRESET: 'preset',
        GROUPS: 'groups',
        TARGETS: 'targets',
        VILLAGES: 'villages',
        WAITING_VILLAGES: 'waiting_villages',
        FULL_STORAGE: 'full_storage',
        LOGS: 'logs'
    }
})
define('two/farm/settings', [], function () {
    return {
        PRESETS: 'presets',
        GROUP_IGNORE: 'group_ignore',
        GROUP_INCLUDE: 'group_include',
        GROUP_ONLY: 'group_only',
        RANDOM_BASE: 'random_base',
        COMMANDS_PER_VILLAGE: 'commands_per_village',
        PRIORITY_TARGETS: 'priority_targets',
        IGNORE_ON_LOSS: 'ignore_on_loss',
        IGNORE_FULL_STORAGE: 'ignore_full_storage',
        STEP_CYCLE: 'step_cycle',
        STEP_CYCLE_NOTIFS: 'step_cycle_notifs',
        STEP_CYCLE_INTERVAL: 'step_cycle_interval',
        MAX_DISTANCE: 'max_distance',
        MIN_DISTANCE: 'min_distance',
        MIN_POINTS: 'min_points',
        MAX_POINTS: 'max_points',
        MAX_TRAVEL_TIME: 'max_travel_time',
        LOGS_LIMIT: 'logs_limit',
        EVENT_ATTACK: 'event_attack',
        EVENT_VILLAGE_CHANGE: 'event_village_change',
        EVENT_PRIORITY_ADD: 'event_priority_add',
        EVENT_IGNORED_VILLAGE: 'event_ignored_village',
        REMOTE_ID: 'remote_id',
        HOTKEY_SWITCH: 'hotkey_switch',
        HOTKEY_WINDOW: 'hotkey_window'
    }
})

define('two/farm/Village', [
    'models/CommandListModel',
    'models/CommandModel',
    'conf/village'
], function (
    CommandListModel,
    CommandModel,
    VILLAGE_CONFIG
) {
    // 'READY_STATES' : {
    //     'COMPLETED'         : 'completed',
    //     'EFFECTS'           : 'effects',
    //     'BUILDINGS'         : 'buildings',
    //     'UNITS'             : 'units',
    //     'UNIT_QUEUE'        : 'unit_queue',
    //     'RESOURCES'         : 'resources',
    //     'TRADES'            : 'trades',
    //     'TIMELINE'          : 'timeline',
    //     'BUILDING_QUEUE'    : 'buildingQueue',
    //     'COMMANDS'          : 'commands',
    //     'OWN_COMMANDS'      : 'ownCommands',
    //     'FOREIGN_COMMANDS'  : 'foreignCommands',
    //     'SCOUTING'          : 'scouting',
    //     'SCOUTING_COMMANDS' : 'scoutingCommands'
    // }

    /**
     * @class
     *
     * @param {VillageModel} original - Objeto original da aldeia.
     */
    function Village (original) {
        this.original = original
        this.id = original.data.villageId
        this.x = original.data.x
        this.y = original.data.y
        this.name = original.data.name
        this.units = original.unitInfo.units
        this.position = original.getPosition()
    }

    Village.prototype.countCommands = function () {
        var commands = this.original.getCommandListModel()

        // commands.getOutgoingCommands(true) obtem a lista de comandos
        // com exceção dos comandos de espionagem.
        return commands.getOutgoingCommands(true).length
    }

    Village.prototype.updateCommands = function (callback) {
        var self = this

        socketService.emit(routeProvider.GET_OWN_COMMANDS, {
            village_id: self.id
        }, function (data) {
            var commandList = new CommandListModel([], self.id)

            for (var i = 0; i < data.commands.length; i++) {
                var command = new CommandModel(data.commands[i])

                commandList.add(command)
            }

            self.original.setCommandListModel(commandList)

            callback()
        })
    }

    Village.prototype.commandsLoaded = function () {
        return this.original.isReady(VILLAGE_CONFIG.OWN_COMMANDS)
    }

    Village.prototype.unitsLoaded = function () {
        return this.original.isReady(VILLAGE_CONFIG.UNITS)
    }

    Village.prototype.loaded = function () {
        if (!this.original.isReady()) {
            return false
        }

        if (!this.original.isInitialized()) {
            return false
        }

        return this.commandsLoaded() && this.unitsLoaded()
    }

    Village.prototype.load = function (callback) {
        var self = this

        return villageService.ensureVillageDataLoaded(this.id, function () {
            if (!self.original.isInitialized()) {
                villageService.initializeVillage(self.original)
            }

            callback()
        })
    }

    return Village
})

require([
    'helper/i18n',
    'two/ready',
    'two/farm',
    'two/farm/ui',
    'two/farm/Events'
], function (
    i18n,
    ready,
    farmOverflow,
    farmOverflowInterface
) {
    if (farmOverflow.isInitialized()) {
        return false
    }

    var updateModuleLang = function () {
        var langs = {"en_us":{"farm":{"attacking":"Attacking.","paused":"Paused.","command_limit":"Limit of 50 attacks reached, waiting return.","last_attack":"Last attack","village_switch":"Changing to village","no_preset":"No presets avaliable.","no_selected_village":"No villages avaliable.","no_units":"No units avaliable in village, waiting attacks return.","no_units_no_commands":"No villages has units or commands returning.","no_villages":"No villages avaliable, waiting attacks return.","preset_first":"Set a preset first!","selected_village":"Village selected","loading_targets":"Loading targets...","checking_targets":"Checking targets...","restarting_commands":"Restarting commands...","ignored_village":"added to the ignored list","priority_target":"added to priorities.","analyse_targets":"Analysing targets.","step_cycle_restart":"Restarting the cycle of commands..","step_cycle_end":"The list of villages ended, waiting for the next run.","step_cycle_end_no_villages":"No villages available to start the cycle.","step_cycle_next":"The list of villages is over, next cycle: %{time}.","step_cycle_next_no_villages":"No village available to start the cycle, next cycle: %{time}.","full_storage":"The storage of the village is full.","farm_paused":"FarmOverflow paused.","farm_started":"FarmOverflow started.","groups_presets":"Groups & presets","presets":"Attack with the presets","group_ignored":"Ignore villages from group","group_include":"Include villages from groups","group_only":"Attack only with villages from groups","random_base":"Random interval between attacks","commands_per_village":"Commands limit per village","priority_targets":"Prioritize targets with full loot","settings.ignoreOnLoss":"Ignore target that cause loss","settings.ignoreFullStorage":"Do not farm with villages with full storage","step_cycle_header":"Step Cycle Settings","settings.stepCycle":"Enable Step Cycle","step_cycle_interval":"Interval between cycles (minutes)","step_cycle_notifs":"Cycle notifications","target_filters":"Target Filters","min_distance":"Minimum distance","max_distance":"Maximum distance","min_points":"Minimum points","max_points":"Maximum points","max_travel_time":"Maximum travel time (minutes)","logs_limit":"Limit of logs","event_attack":"Log attacks","event_village_change":"Log village changes","event_priority_add":"Log priority targets","event_ignored_village":"Log ignored villages","remote":"Remote Control Message Subject","hotkey_switch":"Start/pause hotkey","hotkey_window":"Open window hotkey","settings_saved":"Settings saved!","misc":"Miscellaneous","attack":"attack","no_logs":"No logs registered","clear_logs":"Clear logs","reseted_logs":"Registered logs reseted."}},"pl_pl":{"farm":{"attacking":"Atakuje.","paused":"Zatrzymany.","command_limit":"Limit 50 ataków osiągnięty, oczekiwanie na powrót wojsk.","last_attack":"Ostatni atak","village_switch":"Przejście do wioski","no_preset":"Brak dostępnych szablonów.","no_selected_village":"Brak dostępnych wiosek.","no_units":"Brak dostępnych jednostek w wiosce, oczekiwanie na powrót wojsk.","no_units_no_commands":"Brak jednostek w wioskach lub powracających wojsk.","no_villages":"Brak dostępnych wiosek, oczekiwanie na powrót wojsk.","preset_first":"Wybierz najpierw szablon!","selected_village":"Wybrana wioska","loading_targets":"Ładowanie celów...","checking_targets":"Sprawdzanie celów...","restarting_commands":"Restartowanie poleceń...","ignored_village":"added to the ignored list","priority_target":"dodany do priorytetowych.","analyse_targets":"Analizowanie celów.","step_cycle_restart":"Restartowanie cyklu poleceń...","step_cycle_end":"Lista wiosek zakończona, oczekiwanie na następny cykl.","step_cycle_end_no_villages":"Brak wiosek do rozpoczęcia cyklu.","step_cycle_next":"Lista wiosek się skończyła, następny cykl: %{time}.","step_cycle_next_no_villages":"Brak wioski do rozpoczęcia cyklu, następny cykl: %{time}.","full_storage":"Magazyn w wiosce jest pełny","farm_paused":"Farmer zatrzymany","farm_started":"Farmer uruchomiony","groups_presets":"Groups & presets","presets":"Szablony","group_ignored":"Pomijaj wioski z grupy","group_include":"Dodaj wioski z grupy","group_only":"Tylko wioski z grupy","random_base":"Domyślny odstęp (sek)","commands_per_village":"Limit poleceń","priority_targets":"Priorytyzuj cele","settings.ignoreOnLoss":"Pomijaj cele jeśli straty","settings.ignoreFullStorage":"Pomijaj wioski jeśli magazyn pełny","step_cycle_header":"Cykl Farmienia","settings.stepCycle":"Włącz Cykl farmienia","step_cycle_interval":"Odstęp między cyklami (minuty)","step_cycle_notifs":"Powiadomienia","target_filters":"Filtry celów","min_distance":"Minimalna odległość","max_distance":"Maksymalna odległość","min_points":"Minimalna liczba punktów","max_points":"Maksymalna liczba punktów","max_travel_time":"Maksymalny czas podróży (minuty)","logs_limit":"Limit logów","event_attack":"Logi ataków","event_village_change":"Logi zmiany wiosek","event_priority_add":"Logi celów priorytetowych","event_ignored_village":"Logi pominiętych wiosek","remote":"Sterowanie Zdalne za pomocą wiadomości PW","hotkey_switch":"Skrót Start/Pauza","hotkey_window":"Skrót okna Farmera","settings_saved":"Ustawienia zapisane!","misc":"Miscellaneous","attack":"atakuje","no_logs":"No logs registered","clear_logs":"Clear logs","reseted_logs":"Registered logs reseted."}},"pt_br":{"farm":{"attacking":"Atacando.","paused":"Pausado.","command_limit":"Limite de 50 ataques atingido, aguardando retorno.","last_attack":"Último ataque","village_switch":"Alternando para a aldeia","no_preset":"Nenhuma predefinição disponível.","no_selected_village":"Nenhuma aldeia disponível.","no_units":"Sem unidades na aldeia, aguardando ataques retornarem.","no_units_no_commands":"Nenhuma aldeia tem tropas nem ataques retornando.","no_villages":"Nenhuma aldeia disponível, aguardando ataques retornarem.","preset_first":"Configure uma predefinição primeiro!","selected_village":"Aldeia selecionada","loading_targets":"Carregando alvos...","checking_targets":"Checando alvos...","restarting_commands":"Reiniciando comandos...","ignored_village":"adicionado a lista de ignorados.","priority_target":"adicionado as prioridades.","analyse_targets":"Analisando alvos.","step_cycle_restart":"Reiniciando o ciclo de comandos..","step_cycle_end":"A lista de aldeias acabou, esperando próxima execução.","step_cycle_end_no_villages":"Nenhuma aldeia disponível para iniciar o ciclo.","step_cycle_next":"A lista de aldeias acabou, próximo ciclo: %{time}.","step_cycle_next_no_villages":"Nenhuma aldeia disponível para iniciar o ciclo, próximo ciclo: %{time}.","full_storage":"O armazém da aldeia está cheio.","farm_paused":"FarmOverflow pausado.","farm_started":"FarmOverflow iniciado.","groups_presets":"Grupos & predefinições","presets":"Atacar com as predefinições","group_ignored":"Ignorar aldeias do grupo","group_include":"Include aldeias dos grupos","group_only":"Atacar apenas com aldeias dos grupos","random_base":"Intervalo aleatório entre ataques","commands_per_village":"Limite de comandos por aldeia","priority_targets":"Priorizar alvos com saques cheios","ignore_on_loss":"Ignorar alvos que causam perdas","ignore_full_storage":"Ignorar armazéns lotados","step_cycle_header":"Configurações de Ciclos","step_cycle":"Ativar Ciclo","step_cycle_interval":"Intervalo entre ciclos (minutos)","step_cycle_notifs":"Notificações de ciclos","target_filters":"Filtro de Alvos","min_distance":"Distância mínima","max_distance":"Distância máxima","min_points":"Pontuação mínima","max_points":"Pontuação máxima","max_travel_time":"Tempo máximo de viagem (minutos)","logs_limit":"Limite de registros","event_attack":"Registrar ataques","event_village_change":"Registrar troca de aldeias","event_priority_add":"Registrar alvos prioritarios","event_ignored_village":"Registrar alvos ignorados","remote":"Controle Remoto - Mensagem","hotkey_switch":"Atalho para inicar/pausar","hotkey_window":"Atalho para abrir janela","settings_saved":"Configurações salvas!","misc":"Diversos","attack":"ataca","no_logs":"Nenhum evento registrado","clear_logs":"Limpar eventos","reseted_logs":"Registro de eventos resetado."}}}
        var current = $rootScope.loc.ale
        var data = current in langs
            ? langs[current]
            : langs['en_us']

        i18n.setJSON(data)
    }

    ready(function () {
        updateModuleLang()
        farmOverflow.init()
        farmOverflowInterface()
    }, ['map'])
})

define('two/farm/ui', [
    'two/farm',
    'two/farm/errorTypes',
    'two/farm/logTypes',
    'two/farm/settings',
    'two/ui2',
    'two/FrontButton',
    'queues/EventQueue',
    'struct/MapData',
    'helper/time',
    'two/farm/Events',
    'two/utils',
    'two/EventScope'
], function (
    farmOverflow,
    ERROR_TYPES,
    LOG_TYPES,
    SETTINGS,
    interfaceOverflow,
    FrontButton,
    eventQueue,
    mapData,
    timeHelper,
    farmEventTypes,
    utils,
    EventScope
) {
    var eventScope
    var $scope
    var textObject = 'farm'
    var textObjectCommon = 'common'
    var SELECT_SETTINGS = [
        SETTINGS.PRESETS,
        SETTINGS.GROUP_IGNORE,
        SETTINGS.GROUP_INCLUDE,
        SETTINGS.GROUP_ONLY
    ]
    var TAB_TYPES = {
        SETTINGS: 'settings',
        LOGS: 'logs'
    }
    var DEFAULT_TAB = TAB_TYPES.SETTINGS
    var presetList = modelDataService.getPresetList()
    var groupList = modelDataService.getGroupList()

    var disabledSelects = function (settings) {
        SELECT_SETTINGS.forEach(function (item) {
            if (angular.isArray(settings[item])) {
                if (!settings[item].length) {
                    settings[item] = [disabledOption()]
                }
            } else if (!settings[item]) {
                settings[item] = disabledOption()
            }
        })
    }

    var selectTab = function (tabType) {
        $scope.selectedTab = tabType
    }

    var clearLogs = function () {
        $scope.logs = []
        $scope.visibleLogs = []
        farmOverflow.clearLogs()
    }

    /**
     * Convert the interface friendly settings data to the internal format
     * and update the farmOverflow settings property.
     */
    var saveSettings = function () {
        var settings = angular.copy($scope.settings)

        SELECT_SETTINGS.forEach(function (id) {
            if (angular.isArray(settings[id])) {
                // check if the selected value is not the "disabled" option
                if (settings[id].length && settings[id][0].value) {
                    settings[id] = settings[id].map(function (item) {
                        return item.value
                    })
                } else {
                    settings[id] = []
                }
            } else {
                settings[id] = settings[id].value ? settings[id].value : false
            }
        })

        farmOverflow.updateSettings(settings)
    }

    /**
     * Parse the raw settings to be readable by the interface.
     */
    var parseSettings = function (rawSettings) {
        var settings = angular.copy(rawSettings)
        var groupsObject = {}
        var presetsObject = {}
        var groupId
        var value

        $scope.groups.forEach(function (group) {
            groupsObject[group.value] = {
                name: group.name,
                leftIcon: group.leftIcon
            }
        })

        $scope.presets.forEach(function (preset) {
            presetsObject[preset.value] = preset.name
        })

        SELECT_SETTINGS.forEach(function (item) {
            value = settings[item]

            if (item === 'presets') {
                settings[item] = value.map(function (presetId) {
                    return {
                        name: presetsObject[presetId],
                        value: presetId
                    }
                })
            } else {
                if (angular.isArray(value)) {
                    settings[item] = value.map(function (groupId) {
                        return {
                            name: groupsObject[groupId].name,
                            value: groupId,
                            leftIcon: groupsObject[groupId].leftIcon
                        }
                    })
                } else if (value) {
                    groupId = settings[item]
                    settings[item] = {
                        name: groupsObject[groupId].name,
                        value: groupId,
                        leftIcon: groupsObject[groupId].leftIcon
                    }
                }
            }
        })

        disabledSelects(settings)

        return settings
    }

    /**
     * Used to set the "disabled" option for the select fields.
     * Without these initial values, when all options are uncheck
     * the default value of the select will fallback to the first
     * option of the set.
     *
     * The interface is compiled and only after that,
     * the $scope.settings is populated with the actual values.
     */
    var genInitialSelectValues = function () {
        var obj = {}

        SELECT_SETTINGS.forEach(function (item) {
            obj[item] = item === 'groupIgnore'
                ? disabledOption()
                : [disabledOption()]
        })

        return obj
    }

    var disabledOption = function () {
        return {
            name: $filter('i18n')('disabled', $rootScope.loc.ale, textObjectCommon),
            value: false
        }
    }

    var switchFarm = function () {
        farmOverflow.switchState(true)
    }

    var loadVillagesLabel = function () {
        var load = function (data) {
            if ($scope.villagesLabel[data.coords]) {
                return false
            }

            var coords = data.coords.split('|')
            var x = parseInt(coords[0], 10)
            var y = parseInt(coords[1], 10)
            
            mapData.getTownAtAsync(x, y, function (village) {
                $scope.villagesLabel[data.coords] = `${village.name} (${data.coords})`
            })
        }

        $scope.logs.forEach(function (log) {
            if (log.origin) {
                load(log.origin)
            }

            if (log.target) {
                load(log.target)
            }

            if (log.village) {
                load(log.village)
            }
        })
    }

    var updateVisibleLogs = function () {
        var offset = $scope.pagination.offset
        var limit = $scope.pagination.limit

        $scope.visibleLogs = $scope.logs.slice(offset, offset + limit)
    }

    var eventHandlers = {
        updatePresets: function () {
            $scope.presets = utils.obj2selectOptions(presetList.getPresets())
        },
        updateGroups: function () {
            $scope.groups = utils.obj2selectOptions(groupList.getGroups(), true)
            $scope.groupsWithDisabled = angular.copy($scope.groups)
            $scope.groupsWithDisabled.unshift(disabledOption())
        },
        start: function (event, _manual) {
            $scope.running = true

            if (_manual) {
                utils.emitNotif('success', $filter('i18n')('farm_started', $rootScope.loc.ale, textObject))
            }
        },
        pause: function (event, _manual) {
            $scope.running = false

            if (_manual) {
                utils.emitNotif('success', $filter('i18n')('farm_paused', $rootScope.loc.ale, textObject))
            }
        },
        updateSelectedVillage: function () {
            $scope.selectedVillage = farmOverflow.getSelectedVillage()
        },
        updateLastAttack: function () {
            $scope.lastAttack = farmOverflow.getLastAttack()
        },
        updateCurrentStatus: function (event, status) {
            $scope.currentStatus = status
        },
        updateLogs: function () {
            $scope.logs = angular.copy(farmOverflow.getLogs())

            loadVillagesLabel()
            updateVisibleLogs()
        },
        resetLogsHandler: function () {
            utils.emitNotif('success', $filter('i18n')('reseted_logs', $rootScope.loc.ale, textObject))
        },
        stepCycleEndHandler: function () {
            var settings = farmOverflow.getSettings()
            
            if (settings[SETTINGS.STEP_CYCLE_NOTIFS]) {
                utils.emitNotif('error', $filter('i18n')('step_cycle_end', $rootScope.loc.ale, textObject))
            }
        },
        stepCycleEndNoVillagesHandler: function () {
            utils.emitNotif('error', $filter('i18n')('step_cycle_end_no_villages', $rootScope.loc.ale, textObject))
        },
        stepCycleNextHandler: function () {
            var settings = farmOverflow.getSettings()

            if (settings[SETTINGS.STEP_CYCLE_NOTIFS]) {
                var next = timeHelper.gameTime() + (settings[SETTINGS.STEP_CYCLE_INTERVAL] * 60)

                utils.emitNotif('success', $filter('i18n')('step_cycle_next', $rootScope.loc.ale, textObject, utils.formatDate(next)))
            }
        },
        errorHandler: function (event, args) {
            var error = args[0]
            var manual = args[1]

            if (!manual) {
                return false
            }

            switch (error) {
            case ERROR_TYPES.PRESET_FIRST:
                utils.emitNotif('error', $filter('i18n')('preset_first', $rootScope.loc.ale, textObject))
                break
            case ERROR_TYPES.NO_SELECTED_VILLAGE:
                utils.emitNotif('error', $filter('i18n')('no_selected_village', $rootScope.loc.ale, textObject))
                break
            }
        },
        saveSettingsHandler: function () {
            utils.emitNotif('success', $filter('i18n')('settings_saved', $rootScope.loc.ale, textObject))
        }
    }

    var init = function () {
        var opener = new FrontButton('Farmer', {
            classHover: false,
            classBlur: false,
            onClick: buildWindow
        })

        eventQueue.register(eventTypeProvider.FARM_START, function () {
            opener.$elem.classList.remove('btn-green')
            opener.$elem.classList.add('btn-red')
        })

        eventQueue.register(eventTypeProvider.FARM_PAUSE, function () {
            opener.$elem.classList.remove('btn-red')
            opener.$elem.classList.add('btn-green')
        })

        interfaceOverflow.addTemplate('twoverflow_farm_window', `<div id="two-farmoverflow" class="win-content two-window"><header class="win-head"><h2>FarmOverflow</h2><ul class="list-btn"><li><a href="#" class="size-34x34 btn-red icon-26x26-close" ng-click="closeWindow()"></a></li></ul></header><div class="win-main" scrollbar=""><div class="tabs tabs-bg"><div class="tabs-two-col"><div class="tab" ng-click="selectTab(TAB_TYPES.SETTINGS)" ng-class="{'tab-active': selectedTab == TAB_TYPES.SETTINGS}"><div class="tab-inner"><div ng-class="{'box-border-light': selectedTab === TAB_TYPES.SETTINGS}"><a href="#" ng-class="{'btn-icon btn-orange': selectedTab !== TAB_TYPES.SETTINGS}">{{ TAB_TYPES.SETTINGS | i18n:loc.ale:textObjectCommon }}</a></div></div></div><div class="tab" ng-click="selectTab(TAB_TYPES.LOGS)" ng-class="{'tab-active': selectedTab == TAB_TYPES.LOGS}"><div class="tab-inner"><div ng-class="{'box-border-light': selectedTab === TAB_TYPES.LOGS}"><a href="#" ng-class="{'btn-icon btn-orange': selectedTab !== TAB_TYPES.LOGS}">{{ TAB_TYPES.LOGS | i18n:loc.ale:textObjectCommon }}</a></div></div></div></div></div><div class="box-paper footer"><div class="scroll-wrap"><div class="settings" ng-show="selectedTab === TAB_TYPES.SETTINGS"><table class="tbl-border-light tbl-content tbl-medium-height"><colgroup><col><col width="200px"></colgroup><tr><th colspan="2">{{ 'groups_presets' | i18n:loc.ale:textObject }}</th></tr><tr><td><span class="ff-cell-fix">{{ 'presets' | i18n:loc.ale:textObject }}</span></td><td><div select="" list="presets" selected="settings[SETTINGS.PRESETS]" drop-down="true"></div></td></tr><tr><td><span class="ff-cell-fix">{{ 'group_ignored' | i18n:loc.ale:textObject }}</span></td><td><div select="" list="groupsWithDisabled" selected="settings[SETTINGS.GROUP_IGNORE]" drop-down="true"></div></td></tr><tr><td><span class="ff-cell-fix">{{ 'group_include' | i18n:loc.ale:textObject }}</span></td><td><div select="" list="groups" selected="settings[SETTINGS.GROUP_INCLUDE]" drop-down="true"></div></td></tr><tr><td><span class="ff-cell-fix">{{ 'group_only' | i18n:loc.ale:textObject }}</span></td><td><div select="" list="groups" selected="settings[SETTINGS.GROUP_ONLY]" drop-down="true"></div></td></tr></table><table class="tbl-border-light tbl-content tbl-medium-height"><colgroup><col><col width="200px"><col width="60px"></colgroup><tr><th colspan="3">{{ 'misc' | i18n:loc.ale:textObject }}</th></tr><tr><td><span class="ff-cell-fix">{{ 'random_base' | i18n:loc.ale:textObject }}</span></td><td><div range-slider="" min="0" max="30" value="settings[SETTINGS.RANDOM_BASE]" enabled="true"></div></td><td class="cell-bottom"><input type="text" class="fit textfield-border text-center" ng-model="settings[SETTINGS.RANDOM_BASE]"></td></tr><tr><td><span class="ff-cell-fix">{{ 'commands_per_village' | i18n:loc.ale:textObject }}</span></td><td><div range-slider="" min="0" max="50" value="settings[SETTINGS.COMMANDS_PER_VILLAGE]" enabled="true"></div></td><td class="cell-bottom"><input type="text" class="fit textfield-border text-center" ng-model="settings[SETTINGS.COMMANDS_PER_VILLAGE]"></td></tr><tr><td colspan="2"><span class="ff-cell-fix">{{ 'priority_targets' | i18n:loc.ale:textObject }}</span></td><td><div switch-slider="" enabled="true" border="true" value="settings[SETTINGS.PRIORITY_TARGETS]" vertical="false" size="'56x28'"></div></td></tr><tr><td colspan="2"><span class="ff-cell-fix">{{ 'ignore_on_loss' | i18n:loc.ale:textObject }}</span></td><td><div switch-slider="" enabled="settings[SETTINGS.GROUP_IGNORE].value" border="true" value="settings[SETTINGS.IGNORE_ON_LOSS]" vertical="false" size="'56x28'"></div></td></tr><tr><td colspan="2"><span class="ff-cell-fix">{{ 'ignore_full_storage' | i18n:loc.ale:textObject }}</span></td><td><div switch-slider="" enabled="true" border="true" value="settings[SETTINGS.IGNORE_FULL_STORAGE]" vertical="false" size="'56x28'"></div></td></tr></table><table class="tbl-border-light tbl-content tbl-medium-height"><colgroup><col><col width="200px"><col width="60px"></colgroup><tr><th colspan="3">{{ 'step_cycle_header' | i18n:loc.ale:textObject }}</th></tr><tr><td colspan="2"><span class="ff-cell-fix">{{ 'step_cycle' | i18n:loc.ale:textObject }}</span></td><td><div switch-slider="" enabled="true" border="true" value="settings[SETTINGS.STEP_CYCLE]" vertical="false" size="'56x28'"></div></td></tr><tr><td colspan="2"><span class="ff-cell-fix">{{ 'step_cycle_notifs' | i18n:loc.ale:textObject }}</span></td><td><div switch-slider="" enabled="settings[SETTINGS.STEP_CYCLE]" border="true" value="settings[SETTINGS.STEP_CYCLE_NOTIFS]" vertical="false" size="'56x28'"></div></td></tr><tr><td><span class="ff-cell-fix">{{ 'step_cycle_interval' | i18n:loc.ale:textObject }}</span></td><td><div range-slider="" min="0" max="120" value="settings[SETTINGS.STEP_CYCLE_INTERVAL]" enabled="settings[SETTINGS.STEP_CYCLE]"></div></td><td class="cell-bottom"><input type="text" class="fit textfield-border text-center" ng-model="settings[SETTINGS.STEP_CYCLE_INTERVAL]" ng-disabled="!settings[SETTINGS.STEP_CYCLE]"></td></tr></table><table class="tbl-border-light tbl-content tbl-medium-height"><colgroup><col><col width="200px"><col width="60px"></colgroup><tr><th colspan="3">{{ 'target_filters' | i18n:loc.ale:textObject }}</th></tr><tr><td><span class="ff-cell-fix">{{ 'min_distance' | i18n:loc.ale:textObject }}</span></td><td><div range-slider="" min="0" max="50" value="settings[SETTINGS.MIN_DISTANCE]" enabled="true"></div></td><td class="cell-bottom"><input type="text" class="fit textfield-border text-center" ng-model="settings[SETTINGS.MIN_DISTANCE]"></td></tr><tr><td><span class="ff-cell-fix">{{ 'max_distance' | i18n:loc.ale:textObject }}</span></td><td><div range-slider="" min="0" max="50" value="settings[SETTINGS.MAX_DISTANCE]" enabled="true"></div></td><td class="cell-bottom"><input type="text" class="fit textfield-border text-center" ng-model="settings[SETTINGS.MAX_DISTANCE]"></td></tr><tr><td><span class="ff-cell-fix">{{ 'min_points' | i18n:loc.ale:textObject }}</span></td><td><div range-slider="" min="0" max="13000" value="settings[SETTINGS.MIN_POINTS]" enabled="true"></div></td><td class="cell-bottom"><input type="text" class="fit textfield-border text-center" ng-model="settings[SETTINGS.MIN_POINTS]"></td></tr><tr><td><span class="ff-cell-fix">{{ 'max_points' | i18n:loc.ale:textObject }}</span></td><td><div range-slider="" min="0" max="13000" value="settings[SETTINGS.MAX_POINTS]" enabled="true"></div></td><td class="cell-bottom"><input type="text" class="fit textfield-border text-center" ng-model="settings[SETTINGS.MAX_POINTS]"></td></tr><tr><td><span class="ff-cell-fix">{{ 'max_travel_time' | i18n:loc.ale:textObject }}</span></td><td><div range-slider="" min="0" max="180" value="settings[SETTINGS.MAX_TRAVEL_TIME]" enabled="true"></div></td><td class="cell-bottom"><input type="text" class="fit textfield-border text-center" ng-model="settings[SETTINGS.MAX_TRAVEL_TIME]"></td></tr></table><table class="tbl-border-light tbl-content tbl-medium-height"><colgroup><col><col width="200px"><col width="60px"></colgroup><tr><th colspan="3">{{ TAB_TYPES.LOGS | i18n:loc.ale:textObjectCommon }}</th></tr><tr><td><span class="ff-cell-fix">{{ 'logs_limit' | i18n:loc.ale:textObject }}</span></td><td><div range-slider="" min="0" max="1000" value="settings[SETTINGS.LOGS_LIMIT]" enabled="true"></div></td><td class="cell-bottom"><input type="text" class="fit textfield-border text-center" ng-model="settings[SETTINGS.LOGS_LIMIT]"></td></tr><tr><td colspan="2"><span class="ff-cell-fix">{{ 'event_attack' | i18n:loc.ale:textObject }}</span></td><td><div switch-slider="" enabled="true" border="true" value="settings[SETTINGS.EVENT_ATTACK]" vertical="false" size="'56x28'"></div></td></tr><tr><td colspan="2"><span class="ff-cell-fix">{{ 'event_village_change' | i18n:loc.ale:textObject }}</span></td><td><div switch-slider="" enabled="true" border="true" value="settings[SETTINGS.EVENT_VILLAGE_CHANGE]" vertical="false" size="'56x28'"></div></td></tr><tr><td colspan="2"><span class="ff-cell-fix">{{ 'event_priority_add' | i18n:loc.ale:textObject }}</span></td><td><div switch-slider="" enabled="true" border="true" value="settings[SETTINGS.EVENT_PRIORITY_ADD]" vertical="false" size="'56x28'"></div></td></tr><tr><td colspan="2"><span class="ff-cell-fix">{{ 'event_ignored_village' | i18n:loc.ale:textObject }}</span></td><td><div switch-slider="" enabled="true" border="true" value="settings[SETTINGS.EVENT_IGNORED_VILLAGE]" vertical="false" size="'56x28'"></div></td></tr></table><table class="tbl-border-light tbl-content tbl-medium-height"><colgroup><col><col width="200px"></colgroup><tr><th colspan="2">{{ 'others' | i18n:loc.ale:textObjectCommon }}</th></tr><tr><td><span class="ff-cell-fix">{{ 'remote' | i18n:loc.ale:textObject }}</span></td><td><input type="text" class="fit textfield-border text-center" ng-model="settings[SETTINGS.REMOTE_ID]"></td></tr><tr><td><span class="ff-cell-fix">{{ 'hotkey_switch' | i18n:loc.ale:textObject }}</span></td><td><input type="text" class="fit textfield-border text-center" ng-model="settings[SETTINGS.HOTKEY_SWITCH]"></td></tr><tr><td><span class="ff-cell-fix">{{ 'hotkey_window' | i18n:loc.ale:textObject }}</span></td><td><input type="text" class="fit textfield-border text-center" ng-model="settings[SETTINGS.HOTKEY_WINDOW]"></td></tr></table></div><div class="logs rich-text" ng-show="selectedTab === TAB_TYPES.LOGS"><table class="status tbl-border-light"><colgroup><col width="135px"><col width="*"></colgroup><tbody><tr><td>{{ 'status' | i18n:loc.ale:textObjectCommon }}</td><td><span>{{ currentStatus | i18n:loc.ale:textObject }}</span></td></tr><tr><td>{{ 'selected_village' | i18n:loc.ale:textObject }}</td><td><span ng-show="selectedVillage" class="village-link img-link icon-20x20-village btn btn-orange padded" ng-click="openVillageInfo(selectedVillage.id)">{{ selectedVillage.name }} ({{ selectedVillage.x }}|{{ selectedVillage.y }})</span> <span ng-show="!selectedVillage">{{ 'none' | i18n:loc.ale:textObjectCommon }}</span></td></tr><tr><td>{{ 'last_attack' | i18n:loc.ale:textObject }}</td><td><span ng-show="lastAttack !== -1">{{ lastAttack | readableDateFilter:loc.ale:GAME_TIMEZONE:GAME_TIME_OFFSET }}</span> <span ng-show="lastAttack === -1">{{ 'none' | i18n:loc.ale:textObjectCommon }}</span></td></tr></tbody></table><h5 class="twx-section">{{ TAB_TYPES.LOGS | i18n:loc.ale:textObjectCommon }}</h5><div class="page-wrap" pagination="pagination"></div><p class="text-center" ng-show="!visibleLogs.length">{{ 'no_logs' | i18n:loc.ale:textObject }}</p><table class="log-list tbl-border-light tbl-striped" ng-show="visibleLogs.length"><colgroup><col width="180px"><col width="30px"><col></colgroup><tr ng-repeat="log in visibleLogs"><td>{{ log.time | readableDateFilter:loc.ale:GAME_TIMEZONE:GAME_TIME_OFFSET }}</td><td><span class="icon-bg-black icon-26x26-{{ log.icon }}"></span></td><td ng-if="log.type === LOG_TYPES.ATTACK"><span class="village-link img-link icon-20x20-village btn btn-orange padded" ng-click="openVillageInfo(log.origin.id)" tooltip="" tooltip-content="{{ villagesLabel[log.origin.coords] }}">{{ villagesLabel[log.origin.coords] }}</span> {{ 'attack' | i18n:loc.ale:textObject }} <span class="village-link img-link icon-20x20-village btn btn-orange padded" ng-click="openVillageInfo(log.target.id)" tooltip="" tooltip-content="{{ villagesLabel[log.target.coords] }}">{{ villagesLabel[log.target.coords] }}</span></td><td ng-if="log.type === LOG_TYPES.VILLAGE_SWITCH">{{ 'village_switch' | i18n:loc.ale:textObject }} <span class="village-link img-link icon-20x20-village btn btn-orange padded" ng-click="openVillageInfo(log.village.id)" tooltip="" tooltip-content="{{ villagesLabel[log.village.coords] }}">{{ villagesLabel[log.village.coords] }}</span></td><td ng-if="log.type === LOG_TYPES.NO_PRESET">{{ 'no_preset' | i18n:loc.ale:textObject }}</td><td ng-if="log.type === LOG_TYPES.PRIORITY_TARGET"><span class="village-link img-link icon-20x20-village btn btn-orange padded" ng-click="openVillageInfo(log.village.id)" tooltip="" tooltip-content="{{ villagesLabel[log.village.coords] }}">{{ villagesLabel[log.village.coords] }}</span> {{ 'priority_target' | i18n:loc.ale:textObject }}</td><td ng-if="log.type === LOG_TYPES.IGNORED_VILLAGE"><span class="village-link img-link icon-20x20-village btn btn-orange padded" ng-click="openVillageInfo(log.village.id)" tooltip="" tooltip-content="{{ villagesLabel[log.village.coords] }}">{{ villagesLabel[log.village.coords] }}</span> {{ 'ignored_village' | i18n:loc.ale:textObject }}</td></tr></table><div class="page-wrap" pagination="pagination"></div></div></div></div></div><footer class="win-foot"><ul class="list-btn list-center"><li ng-show="selectedTab === TAB_TYPES.SETTINGS"><a href="#" class="btn-border btn-orange" ng-click="saveSettings()">{{ 'save' | i18n:loc.ale:textObjectCommon }}</a></li><li ng-show="selectedTab === TAB_TYPES.LOGS"><a href="#" class="btn-border btn-orange" ng-click="clearLogs()">{{ 'clear_logs' | i18n:loc.ale:textObject }}</a></li><li><a href="#" ng-class="{false:'btn-green', true:'btn-red'}[running]" class="btn-border" ng-click="switchFarm()"><span ng-show="running">{{ 'pause' | i18n:loc.ale:textObjectCommon }}</span> <span ng-show="!running">{{ 'start' | i18n:loc.ale:textObjectCommon }}</span></a></li></ul></footer></div>`)
        interfaceOverflow.addStyle('#two-farmoverflow .settings table{margin-bottom:15px}#two-farmoverflow .settings input.textfield-border{padding-top:6px;width:219px;height:34px}#two-farmoverflow .settings input.textfield-border.fit{width:100%}#two-farmoverflow .settings span.select-wrapper{width:219px}#two-farmoverflow .settings .range-container{width:350px}#two-farmoverflow .logs .status tr{height:25px}#two-farmoverflow .logs .status td{padding:0 6px}#two-farmoverflow .logs .log-list{margin-bottom:10px}#two-farmoverflow .logs .log-list td{text-align:center}#two-farmoverflow .logs .log-list td .village-link{max-width:200px;white-space:nowrap;text-overflow:ellipsis}')
    }

    var buildWindow = function () {
        $scope = $rootScope.$new()
        $scope.textObject = textObject
        $scope.textObjectCommon = textObjectCommon
        $scope.SETTINGS = SETTINGS
        $scope.TAB_TYPES = TAB_TYPES
        $scope.LOG_TYPES = LOG_TYPES
        $scope.presets = []
        $scope.groups = []
        $scope.groupsWithDisabled = []
        $scope.selectedTab = DEFAULT_TAB
        $scope.settings = genInitialSelectValues()
        $scope.selectedVillage = farmOverflow.getSelectedVillage()
        $scope.lastAttack = farmOverflow.getLastAttack()
        $scope.running = farmOverflow.isRunning()
        $scope.currentStatus = farmOverflow.getCurrentStatus()
        $scope.logs = farmOverflow.getLogs()
        $scope.villagesLabel = {}
        $scope.visibleLogs = []
        $scope.pagination = {
            count: $scope.logs.length,
            offset: 0,
            loader: updateVisibleLogs,
            limit: storageService.getPaginationLimit()
        }
        

        eventHandlers.updatePresets()
        eventHandlers.updateGroups()
        eventHandlers.updateSelectedVillage()
        eventHandlers.updateLastAttack()
        updateVisibleLogs()
        loadVillagesLabel()

        // scope functions
        $scope.selectTab = selectTab
        $scope.saveSettings = saveSettings
        $scope.clearLogs = clearLogs
        $scope.switchFarm = switchFarm
        $scope.jumpToVillage = mapService.jumpToVillage
        $scope.openVillageInfo = windowDisplayService.openVillageInfo

        eventScope = new EventScope('twoverflow_farm_window')
        eventScope.register(eventTypeProvider.ARMY_PRESET_UPDATE, eventHandlers.updatePresets, true)
        eventScope.register(eventTypeProvider.ARMY_PRESET_DELETED, eventHandlers.updatePresets, true)
        eventScope.register(eventTypeProvider.GROUPS_UPDATED, eventHandlers.updateGroups, true)
        eventScope.register(eventTypeProvider.GROUPS_CREATED, eventHandlers.updateGroups, true)
        eventScope.register(eventTypeProvider.GROUPS_DESTROYED, eventHandlers.updateGroups, true)
        eventScope.register(eventTypeProvider.FARM_START, eventHandlers.start)
        eventScope.register(eventTypeProvider.FARM_PAUSE, eventHandlers.pause)
        eventScope.register(eventTypeProvider.FARM_VILLAGES_UPDATE, eventHandlers.updateSelectedVillage)
        eventScope.register(eventTypeProvider.FARM_NEXT_VILLAGE, eventHandlers.updateSelectedVillage)
        eventScope.register(eventTypeProvider.FARM_SEND_COMMAND, eventHandlers.updateLastAttack)
        eventScope.register(eventTypeProvider.FARM_STATUS_CHANGE, eventHandlers.updateCurrentStatus)
        eventScope.register(eventTypeProvider.FARM_RESET_LOGS, eventHandlers.updateLogs)
        eventScope.register(eventTypeProvider.FARM_LOGS_RESETED, eventHandlers.resetLogsHandler)
        eventScope.register(eventTypeProvider.FARM_LOGS_UPDATED, eventHandlers.updateLogs)
        eventScope.register(eventTypeProvider.FARM_STEP_CYCLE_END, eventHandlers.stepCycleEndHandler)
        eventScope.register(eventTypeProvider.FARM_STEP_CYCLE_END_NO_VILLAGES, eventHandlers.stepCycleEndNoVillagesHandler)
        eventScope.register(eventTypeProvider.FARM_STEP_CYCLE_NEXT, eventHandlers.stepCycleNextHandler)
        eventScope.register(eventTypeProvider.FARM_ERROR, eventHandlers.errorHandler)
        eventScope.register(eventTypeProvider.FARM_SETTINGS_CHANGE, eventHandlers.saveSettingsHandler)

        windowManagerService.getScreenWithInjectedScope('!twoverflow_farm_window', $scope)
        $scope.settings = parseSettings(farmOverflow.getSettings())
    }

    return init
})

define('two/minimap', [
    'two/minimap/actionTypes',
    'two/minimap/settings',
    'two/minimap/settingsMap',
    'two/utils',
    'queues/EventQueue',
    'two/ready',
    'Lockr',
    'struct/MapData',
    'conf/conf',
    'helper/time',
    'helper/mapconvert',
    'cdn',
    'conf/colors',
    'conf/colorGroups'
], function (
    ACTION_TYPES,
    SETTINGS,
    SETTINGS_MAP,
    utils,
    eventQueue,
    ready,
    Lockr,
    $mapData,
    $conf,
    $timeHelper,
    $mapconvert,
    $cdn,
    colors,
    colorGroups
) {
    var enableRendering = false
    var highlights = {}
    var villageSize = 5
    var villageMargin = 1
    var rhex = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/
    var cache = {
        village: {},
        character: {},
        tribe: {}
    }
    // Cached villages from previous loaded maps.
    // Used to draw the "ghost" villages on the map.
    var cachedVillages = {}
    // Data of the village that the user is hovering on the minimap.
    var hoverVillage = null
    var $viewport
    var $viewportContext
    var $viewportCache
    var $viewportCacheContext
    var $cross
    var $crossContext
    // Game main canvas map.
    // Used to calculate the position cross position based on canvas size.
    var $map
    var $player
    var $tribeRelations
    var selectedVillage
    var currentPosition = {}
    var frameSize = {}
    var dataView
    var settings = {}
    var STORAGE_ID = {
        CACHE_VILLAGES: 'minimap_cache_villages',
        SETTINGS: 'minimap_settings'
    }
    var colorService = injector.get('colorService')
    var allowJump = true
    var allowMove = false
    var dragStart = {}

    /**
     * Calcule the coords from clicked position in the canvas.
     *
     * @param {Object} event - Canvas click event.
     * @return {Object} X and Y coordinates.
     */
    var getCoords = function (event) {
        var villageBlock = minimap.getVillageBlock()
        var villageOffsetX = minimap.getVillageAxisOffset()
        var rawX = Math.ceil(currentPosition.x + event.offsetX)
        var rawY = Math.ceil(currentPosition.y + event.offsetY)
        var adjustLine = Math.floor((rawY / villageBlock) % 2)

        if (adjustLine % 2) {
            rawX -= villageOffsetX
        }
        
        rawX -= rawX % villageBlock
        rawY -= rawY % villageBlock

        return {
            x: Math.ceil((rawX - frameSize.x / 2) / villageBlock),
            y: Math.ceil((rawY - frameSize.y / 2) / villageBlock)
        }
    }

    /**
     * Convert pixel wide map position to coords
     *
     * @param {Number} x - X pixel position.
     * @param {Number} y - Y pixel position.
     * @return {Object} Y and Y coordinates.
     */
    var pixel2Tiles = function (x, y) {
        return {
            x: (x / $conf.TILESIZE.x),
            y: (y / $conf.TILESIZE.y / $conf.TILESIZE.off)
        }
    }

    /**
     * Calculate the coords based on zoom.
     *
     * @param {Array[x, y, canvasW, canvasH]} rect - Coords and canvas size.
     * @param {Number} zoom - Current zoom used to display the game original map.
     * @return {Array} Calculated coords.
     */
    var convert = function (rect, zoom) {
        zoom = 1 / (zoom || 1)

        var xy = pixel2Tiles(rect[0] * zoom, rect[1] * zoom)
        var wh = pixel2Tiles(rect[2] * zoom, rect[3] * zoom)
        
        return [
            xy.x - 1,
            xy.y - 1,
            (wh.x + 3) || 1,
            (wh.y + 3) || 1
        ]
    }

    /**
     * @param {Array} villages
     * @param {String=} _color - Force the village to use the
     *   specified color.
     */
    var drawVillages = function (villages, _color) {
        var v
        var x
        var y
        var color
        var pid = $player.getId()
        var tid = $player.getTribeId()
        var villageBlock = minimap.getVillageBlock()
        var villageSize = minimap.getVillageSize()
        var villageOffsetX = minimap.getVillageAxisOffset()
        var villageColors = $player.getVillagesColors()
        var i

        for (i = 0; i < villages.length; i++) {
            v = villages[i]

            // meta village
            if (v.id < 0) {
                continue
            }

            if (_color) {
                color = _color
                
                x = v[0] * villageBlock
                y = v[1] * villageBlock

                if (v[1] % 2) {
                    x += villageOffsetX
                }
            } else {
                x = v.x * villageBlock
                y = v.y * villageBlock

                if (v.y % 2) {
                    x += villageOffsetX
                }

                if (settings[SETTINGS.SHOW_ONLY_CUSTOM_HIGHLIGHTS]) {
                    if (v.character_id in highlights.character) {
                        color = highlights.character[v.character_id]
                    } else if (v.tribe_id in highlights.tribe) {
                        color = highlights.tribe[v.tribe_id]
                    } else {
                        continue
                    }
                } else {
                    if (v.character_id === null) {
                        if (!settings[SETTINGS.SHOW_BARBARIANS]) {
                            continue
                        }

                        color = villageColors.barbarian
                    } else {
                        if (v.character_id === pid) {
                            if (v.id === selectedVillage.getId() && settings[SETTINGS.HIGHLIGHT_SELECTED]) {
                                color = villageColors.selected
                            } else if (v.character_id in highlights.character) {
                                color = highlights.character[v.character_id]
                            } else if (settings[SETTINGS.HIGHLIGHT_OWN]) {
                                color = villageColors.player
                            } else {
                                color = villageColors.ugly
                            }
                        } else {
                            if (v.character_id in highlights.character) {
                                color = highlights.character[v.character_id]
                            } else if (v.tribe_id in highlights.tribe) {
                                color = highlights.tribe[v.tribe_id]
                            } else if (tid && tid === v.tribe_id && settings[SETTINGS.HIGHLIGHT_DIPLOMACY]) {
                                color = villageColors.tribe
                            } else if ($tribeRelations && settings[SETTINGS.HIGHLIGHT_DIPLOMACY]) {
                                if ($tribeRelations.isAlly(v.tribe_id)) {
                                    color = villageColors.ally
                                } else if ($tribeRelations.isEnemy(v.tribe_id)) {
                                    color = villageColors.enemy
                                } else if ($tribeRelations.isNAP(v.tribe_id)) {
                                    color = villageColors.friendly
                                } else {
                                    color = villageColors.ugly
                                }
                            } else {
                                color = villageColors.ugly
                            }
                        }
                    }
                }
            }

            $viewportCacheContext.fillStyle = color
            $viewportCacheContext.fillRect(x, y, villageSize, villageSize)
        }
    }

    var drawGrid = function () {
        var binUrl = $cdn.getPath($conf.getMapPath())
        var villageBlock = minimap.getVillageBlock()
        var villageOffsetX = Math.round(villageBlock / 2)
        var tile
        var x
        var y

        utils.xhrGet(binUrl, function (bin) {
            dataView = new DataView(bin)

            for (x = 1; x < 999; x++) {
                for (y = 1; y < 999; y++) {
                    tile = $mapconvert.toTile(dataView, x, y)
                    
                    // is border
                    if (tile.key.b) {
                        // is continental border
                        if (tile.key.c) {
                            $viewportCacheContext.fillStyle = settings[SETTINGS.COLOR_CONTINENT]
                            $viewportCacheContext.fillRect(x * villageBlock + villageOffsetX - 1, y * villageBlock + villageOffsetX - 1, 3, 1)
                            $viewportCacheContext.fillRect(x * villageBlock + villageOffsetX, y * villageBlock + villageOffsetX - 2, 1, 3)
                        } else {
                            $viewportCacheContext.fillStyle = settings[SETTINGS.COLOR_PROVINCE]
                            $viewportCacheContext.fillRect(x * villageBlock + villageOffsetX, y * villageBlock + villageOffsetX - 1, 1, 1)
                        }
                    }
                }
            }
        }, 'arraybuffer')
    }

    var drawLoadedVillages = function () {
        drawVillages($mapData.getTowns())
    }

    var drawCachedVillages = function () {
        var x
        var y
        var i
        var xx
        var yy
        var village
        var villageBlock = minimap.getVillageBlock()
        var villageSize = minimap.getVillageSize()
        var villageOffsetX = minimap.getVillageAxisOffset()

        for (x in cachedVillages) {
            for (i = 0; i < cachedVillages[x].length; i++) {
                y = cachedVillages[x][i]
                xx = x * villageBlock
                yy = y * villageBlock

                if (y % 2) {
                    xx += villageOffsetX
                }

                $viewportCacheContext.fillStyle = settings[SETTINGS.COLOR_GHOST]
                $viewportCacheContext.fillRect(xx, yy, villageSize, villageSize)
            }
        }
    }

    /**
     * @param {Object} pos - Minimap current position plus center of canvas.
     */
    var drawViewport = function (pos) {
        $viewportContext.drawImage($viewportCache, -pos.x, -pos.y)
    }

    /**
     * @return {[type]} [description]
     */
    var clearViewport = function () {
        $viewportContext.clearRect(0, 0, $viewport.width, $viewport.height)
    }

    /**
     * @param {Object} pos - Minimap current position plus center of canvas.
     */
    var drawCross = function (pos) {
        var villageBlock = minimap.getVillageBlock()
        var lineSize = minimap.getLineSize()
        var mapPosition = minimap.getMapPosition()

        var x = ((mapPosition[0] + mapPosition[2] - 2) * villageBlock) - pos.x
        var y = ((mapPosition[1] + mapPosition[3] - 2) * villageBlock) - pos.y

        $crossContext.fillStyle = settings[SETTINGS.COLOR_CROSS]
        $crossContext.fillRect(x | 0, 0, 1, lineSize)
        $crossContext.fillRect(0, y | 0, lineSize, 1)
    }

    var clearCross = function () {
        $crossContext.clearRect(0, 0, $cross.width, $cross.height)
    }

    var renderStep = function () {
        if(enableRendering) {
            var pos =  {
                x: currentPosition.x - (frameSize.x / 2),
                y: currentPosition.y - (frameSize.y / 2)
            }

            clearViewport()
            clearCross()

            drawViewport(pos)

            if (settings[SETTINGS.SHOW_CROSS]) {
                drawCross(pos)
            }
        }

        window.requestAnimationFrame(renderStep)
    }

    /**
     * @param {Number} sectors - Amount of sectors to be loaded,
     *   each sector has a size of 25x25 fields.
     * @param {Number=} x Optional load center X
     * @param {Number=} y Optional load center Y
     */
    var preloadSectors = function (sectors, _x, _y) {
        var size = sectors * 25
        var x = (_x || selectedVillage.getX()) - (size / 2)
        var y = (_y || selectedVillage.getY()) - (size / 2)

        $mapData.loadTownDataAsync(x, y, size, size, function () {})
    }

    var cacheVillages = function (villages) {
        var i
        var v

        for (i = 0; i < villages.length; i++) {
            v = villages[i]

            // meta village
            if (v.id < 0) {
                continue
            }

            if (!(v.x in cache.village)) {
                cache.village[v.x] = {}
            }

            if (!(v.x in cachedVillages)) {
                cachedVillages[v.x] = []
            }

            cache.village[v.x][v.y] = v.character_id || 0
            cachedVillages[v.x].push(v.y)

            if (v.character_id) {
                if (v.character_id in cache.character) {
                    cache.character[v.character_id].push([v.x, v.y])
                } else {
                    cache.character[v.character_id] = [[v.x, v.y]]
                }

                if (v.tribe_id) {
                    if (v.tribe_id in cache.tribe) {
                        cache.tribe[v.tribe_id].push(v.character_id)
                    } else {
                        cache.tribe[v.tribe_id] = [v.character_id]
                    }
                }
            }
        }

        Lockr.set(STORAGE_ID.CACHE_VILLAGES, cachedVillages)
    }

    var onHoverVillage = function (coords, event) {
        var pid

        if (hoverVillage) {
            if (hoverVillage.x === coords.x && hoverVillage.y === coords.y) {
                return false
            } else {
                onBlurVillage()
            }
        }

        eventQueue.trigger(eventTypeProvider.MINIMAP_VILLAGE_HOVER, {
            village: $mapData.getTownAt(coords.x, coords.y),
            event: event
        })

        hoverVillage = { x: coords.x, y: coords.y }
        pid = cache.village[coords.x][coords.y]

        if (pid) {
            highlightVillages(cache.character[pid])
        } else {
            highlightVillages([[coords.x, coords.y]])
        }
    }

    var onBlurVillage = function () {
        var pid

        if (!hoverVillage) {
            return false
        }

        pid = cache.village[hoverVillage.x][hoverVillage.y]

        if (pid) {
            unhighlightVillages(cache.character[pid])
        } else {
            unhighlightVillages([[hoverVillage.x, hoverVillage.y]])
        }

        hoverVillage = false
        eventQueue.trigger(eventTypeProvider.MINIMAP_VILLAGE_BLUR)
    }

    var highlightVillages = function (villages) {
        drawVillages(villages, settings[SETTINGS.COLOR_QUICK_HIGHLIGHT])
    }

    var unhighlightVillages = function (villages) {
        var _villages = []
        var i

        for (i = 0; i < villages.length; i++) {
            _villages.push($mapData.getTownAt(villages[i][0], villages[i][1]))
        }

        drawVillages(_villages)
    }

    var quickHighlight = function (coords) {
        var village = $mapData.getTownAt(coords.x, coords.y)
        var action = settings[SETTINGS.RIGHT_CLICK_ACTION]
        var type
        var id
        var data = {}

        if (!village) {
            return false
        }

        switch (settings[SETTINGS.RIGHT_CLICK_ACTION]) {
        case ACTION_TYPES.HIGHLIGHT_PLAYER:
            if (!village.character_id) {
                return false
            }

            data.type = 'character'
            data.id = village.character_id

            break
        case ACTION_TYPES.HIGHLIGHT_TRIBE:
            if (!village.tribe_id) {
                return false
            }

            data.type = 'tribe'
            data.id = village.tribe_id

            break
        }

        minimap.addHighlight(data, '#' + colors.palette.random().random())
    }

    var eventHandlers = {
        onCrossMouseDown: function (event) {
            event.preventDefault()

            allowJump = true
            allowMove = true
            dragStart = {
                x: currentPosition.x + event.pageX,
                y: currentPosition.y + event.pageY
            }

            if (hoverVillage) {
                eventQueue.trigger(eventTypeProvider.MINIMAP_VILLAGE_CLICK, [hoverVillage, event])

                // right click
                if (event.which === 3) {
                    quickHighlight(hoverVillage)
                }
            }
        },
        onCrossMouseUp: function () {
            allowMove = false
            dragStart = {}

            if (!allowJump) {
                eventQueue.trigger(eventTypeProvider.MINIMAP_STOP_MOVE)
            }
        },
        onCrossMouseMove: function (event) {
            var coords
            var village
            var highlighted

            allowJump = false

            if (allowMove) {
                currentPosition.x = dragStart.x - event.pageX
                currentPosition.y = dragStart.y - event.pageY
                eventQueue.trigger(eventTypeProvider.MINIMAP_START_MOVE)
            }

            coords = getCoords(event)

            if (coords.x in cache.village) {
                if (coords.y in cache.village[coords.x]) {
                    village = $mapData.getTownAt(coords.x, coords.y)

                    // ignore barbarian villages
                    if (!settings[SETTINGS.SHOW_BARBARIANS] && !village.character_id) {
                        return false
                    }

                    // check if the village is custom highlighted
                    if (settings[SETTINGS.SHOW_ONLY_CUSTOM_HIGHLIGHTS]) {
                        highlighted = false

                        if (village.character_id in highlights.character) {
                            highlighted = true
                        } else if (village.tribe_id in highlights.tribe) {
                            highlighted = true
                        }

                        if (!highlighted) {
                            return false
                        }
                    }

                    return onHoverVillage(coords, event)
                }
            }

            onBlurVillage()
        },
        onCrossMouseLeave: function () {
            if (hoverVillage) {
                onBlurVillage()
            }

            eventQueue.trigger(eventTypeProvider.MINIMAP_MOUSE_LEAVE)
        },
        onCrossMouseClick: function (event) {
            if (!allowJump) {
                return false
            }

            var coords = getCoords(event)
            $rootScope.$broadcast(eventTypeProvider.MAP_CENTER_ON_POSITION, coords.x, coords.y, true)
            preloadSectors(2, coords.x, coords.y)
        },
        onCrossMouseContext: function (event) {
            event.preventDefault()
            return false
        },
        onVillageData: function (event, data) {
            drawVillages(data.villages)
            cacheVillages(data.villages)
        },
        onHighlightChange: function () {
            highlights.tribe = colorService.getCustomColorsByGroup(colorGroups.TRIBE_COLORS) || {}
            highlights.character = colorService.getCustomColorsByGroup(colorGroups.PLAYER_COLORS) || {}

            drawLoadedVillages()
        },
        onSelectedVillageChange: function () {
            var old = {
                id: selectedVillage.getId(),
                x: selectedVillage.getX(),
                y: selectedVillage.getY()
            }

            selectedVillage = $player.getSelectedVillage()

            drawVillages([{
                character_id: $player.getId(),
                id: old.id,
                x: old.x,
                y: old.y
            }, {
                character_id: $player.getId(),
                id: selectedVillage.getId(),
                x: selectedVillage.getX(),
                y: selectedVillage.getY()
            }])
        }
    }

    var minimap = {
        SETTINGS_MAP: SETTINGS_MAP,
        ACTION_TYPES: ACTION_TYPES
    }

    minimap.setVillageSize = function (value) {
        villageSize = value
    }

    minimap.getVillageSize = function () {
        return villageSize
    }

    minimap.setVillageMargin = function (value) {
        villageMargin = value
    }

    minimap.getVillageMargin = function () {
        return villageMargin
    }

    /**
     * Get the size used by each village on minimap in pixels.
     *
     * @return {Number}
     */
    minimap.getVillageBlock = function () {
        return villageSize + villageMargin
    }

    minimap.getLineSize = function () {
        return 1000 * (villageSize + villageMargin)
    }

    /**
     * Get the center position of a village icon.
     *
     * @return {Number}
     */
    minimap.getVillageAxisOffset = function () {
        return Math.round(villageSize / 2)
    }

    /**
     * @param {Object} item - Highlight item.
     * @param {String} item.type - village, player or tribe
     * @param {String} item.id - village/player/tribe id
     * @param {Number=} item.x - village X coord.
     * @param {Number=} item.y - village Y coord.
     * @param {String} color - Hex color
     *
     * @return {Boolean} true if successfully added
     */
    minimap.addHighlight = function (item, color) {
        var colorGroup

        if (!item || !item.type || !item.id) {
            eventQueue.trigger(eventTypeProvider.MINIMAP_HIGHLIGHT_ADD_ERROR_NO_ENTRY)
            return false
        }

        if (!rhex.test(color)) {
            eventQueue.trigger(eventTypeProvider.MINIMAP_HIGHLIGHT_ADD_ERROR_INVALID_COLOR)
            return false
        }

        highlights[item.type][item.id] = color
        colorGroup = item.type === 'character' ? colorGroups.PLAYER_COLORS : colorGroups.TRIBE_COLORS
        colorService.setCustomColorsByGroup(colorGroup, highlights[item.type])
        $rootScope.$broadcast(eventTypeProvider.GROUPS_VILLAGES_CHANGED)

        drawLoadedVillages()

        return true
    }

    minimap.removeHighlight = function (type, itemId) {
        var colorGroup = type === 'character' ? colorGroups.PLAYER_COLORS : colorGroups.TRIBE_COLORS

        if (highlights[type][itemId]) {
            delete highlights[type][itemId]
            colorService.setCustomColorsByGroup(colorGroup, highlights[type])
            $rootScope.$broadcast(eventTypeProvider.GROUPS_VILLAGES_CHANGED)

            drawLoadedVillages()

            return true
        }

        return false
    }

    minimap.getHighlight = function (type, item) {
        if (highlights[type].hasOwnProperty(item)) {
            return highlights[type][item]
        } else {
            return false
        }
    }

    minimap.getHighlights = function () {
        return highlights
    }

    minimap.eachHighlight = function (callback) {
        for (var type in highlights) {
            for (var id in highlights[type]) {
                callback(type, id, highlights[type][id])
            }
        }
    }

    minimap.setViewport = function (element) {
        $viewport = element
        $viewport.style.background = settings[SETTINGS.COLOR_BACKGROUND]
        $viewportContext = $viewport.getContext('2d')
    }

    minimap.setCross = function (element) {
        $cross = element
        $crossContext = $cross.getContext('2d')
    }

    minimap.setCurrentPosition = function (x, y) {
        var block = minimap.getVillageBlock()

        currentPosition.x = x * block + 50
        currentPosition.y = y * block + (1000 - ((document.body.clientHeight - 238) / 2)) + 50
    }

    /**
     * @return {Array}
     */
    minimap.getMapPosition = function () {
        var view

        if (!$map.width || !$map.height) {
            return false
        }

        view = window.twx.game.map.engine.getView()

        return convert([
            -view.x,
            -view.y,
            $map.width / 2,
            $map.height / 2
        ], view.z)
    }

    /**
     * @param {Object} changes - New settings.
     * @return {Boolean} True if the internal settings changed.
     */
    minimap.updateSettings = function (changes) {
        var newValue
        var key
        var settingMap
        var updateMinimap = false

        for (key in changes) {
            settingMap = SETTINGS_MAP[key]
            newValue = changes[key]

            if (!settingMap || angular.equals(settings[key], newValue)) {
                continue
            }

            if (settingMap.update) {
                updateMinimap = true
            }

            settings[key] = newValue
        }

        Lockr.set(STORAGE_ID.SETTINGS, settings)

        if (updateMinimap) {
            minimap.update()
        }

        eventQueue.trigger(eventTypeProvider.MINIMAP_SETTINGS_SAVE)

        return true
    }

    minimap.resetSettings = function () {
        for (var key in SETTINGS_MAP) {
            settings[key] = SETTINGS_MAP[key].default
        }

        Lockr.set(STORAGE_ID.SETTINGS, settings)
        minimap.update()
        eventQueue.trigger(eventTypeProvider.MINIMAP_SETTINGS_RESET)
    }

    minimap.getSettings = function () {
        return settings
    }

    minimap.update = function () {
        var villageBlock = minimap.getVillageBlock()

        $viewport.style.background = settings[SETTINGS.COLOR_BACKGROUND]
        $viewportCacheContext.clearRect(0, 0, $viewportCache.width, $viewportCache.height)

        if (settings[SETTINGS.SHOW_DEMARCATIONS]) {
            drawGrid()
        }

        if (settings[SETTINGS.SHOW_GHOST_VILLAGES]) {
            drawCachedVillages()
        }

        drawLoadedVillages()
    }

    minimap.enableRendering = function () {
        enableRendering = true
    }

    minimap.disableRendering = function () {
        enableRendering = false
    }

    minimap.init = function () {
        var localSettings
        var key
        var defaultValue

        minimap.initialized = true
        $viewportCache = document.createElement('canvas')
        $viewportCacheContext = $viewportCache.getContext('2d')
        localSettings = Lockr.get(STORAGE_ID.SETTINGS, {}, true)

        for (key in SETTINGS_MAP) {
            defaultValue = SETTINGS_MAP[key].default
            settings[key] = localSettings.hasOwnProperty(key) ? localSettings[key] : defaultValue
        }

        highlights.tribe = colorService.getCustomColorsByGroup(colorGroups.TRIBE_COLORS) || {}
        highlights.character = colorService.getCustomColorsByGroup(colorGroups.PLAYER_COLORS) || {}
    }

    minimap.run = function () {
        var villageBlock

        ready(function () {
            $map = document.getElementById('main-canvas')
            $player = modelDataService.getSelectedCharacter()
            $tribeRelations = $player.getTribeRelations()
            cachedVillages = Lockr.get(STORAGE_ID.CACHE_VILLAGES, {}, true)
            
            villageBlock = minimap.getVillageBlock()
            currentPosition.x = 500 * villageBlock
            currentPosition.y = 500 * villageBlock

            frameSize.x = 701
            frameSize.y = 2000

            $viewport.setAttribute('width', frameSize.x)
            $viewport.setAttribute('height', frameSize.y)
            $viewportContext.imageSmoothingEnabled = false

            $viewportCache.setAttribute('width', 1000 * villageBlock)
            $viewportCache.setAttribute('height', 1000 * villageBlock)
            $viewportCache.imageSmoothingEnabled = false

            $cross.setAttribute('width', frameSize.x)
            $cross.setAttribute('height', frameSize.y)
            $crossContext.imageSmoothingEnabled = false

            selectedVillage = $player.getSelectedVillage()
            currentPosition.x = selectedVillage.getX() * villageBlock
            currentPosition.y = selectedVillage.getY() * villageBlock

            if (settings[SETTINGS.SHOW_DEMARCATIONS]) {
                drawGrid()
            }

            if (settings[SETTINGS.SHOW_GHOST_VILLAGES]) {
                drawCachedVillages()
            }

            drawLoadedVillages()
            cacheVillages($mapData.getTowns())
            preloadSectors(2)
            renderStep()

            $cross.addEventListener('mousedown', eventHandlers.onCrossMouseDown)
            $cross.addEventListener('mouseup', eventHandlers.onCrossMouseUp)
            $cross.addEventListener('mousemove', eventHandlers.onCrossMouseMove)
            $cross.addEventListener('mouseleave', eventHandlers.onCrossMouseLeave)
            $cross.addEventListener('click', eventHandlers.onCrossMouseClick)
            $cross.addEventListener('contextmenu', eventHandlers.onCrossMouseContext)
            $rootScope.$on(eventTypeProvider.MAP_VILLAGE_DATA, eventHandlers.onVillageData)
            $rootScope.$on(eventTypeProvider.VILLAGE_SELECTED_CHANGED, eventHandlers.onSelectedVillageChange)
            $rootScope.$on(eventTypeProvider.TRIBE_RELATION_CHANGED, drawLoadedVillages)
            $rootScope.$on(eventTypeProvider.GROUPS_VILLAGES_CHANGED, eventHandlers.onHighlightChange)
        }, ['initial_village', 'tribe_relations'])
    }

    return minimap
})

define('two/minimap/actionTypes', [], function () {
    return {
        HIGHLIGHT_PLAYER: 'highlight_player',
        HIGHLIGHT_TRIBE: 'highlight_tribe'
    }
})

define('two/minimap/Events', [], function () {
    angular.extend(eventTypeProvider, {
        MINIMAP_SETTINGS_RESET: 'minimap_settings_reset',
        MINIMAP_SETTINGS_SAVE: 'minimap_settings_save',
        MINIMAP_HIGHLIGHT_ADD_ERROR_EXISTS: 'minimap_highlight_add_error_exists',
        MINIMAP_HIGHLIGHT_ADD_ERROR_NO_ENTRY: 'minimap_highlight_add_error_no_entry',
        MINIMAP_HIGHLIGHT_ADD_ERROR_INVALID_COLOR: 'minimap_highlight_add_error_invalid_color',
        MINIMAP_VILLAGE_CLICK: 'minimap_village_click',
        MINIMAP_VILLAGE_HOVER: 'minimap_village_hover',
        MINIMAP_VILLAGE_BLUR: 'minimap_village_blur',
        MINIMAP_MOUSE_LEAVE: 'minimap_mouse_leave',
        MINIMAP_START_MOVE: 'minimap_start_move',
        MINIMAP_STOP_MOVE: 'minimap_stop_move'
    })
})

define('two/minimap/settingsMap', [
    'two/minimap/settings',
    'two/minimap/actionTypes'
], function (
    SETTINGS,
    ACTION_TYPES
) {
    return {
        [SETTINGS.RIGHT_CLICK_ACTION]: {
            default: ACTION_TYPES.HIGHLIGHT_PLAYER,
            inputType: 'select',
            update: false
        },
        // [SETTINGS.FLOATING_MINIMAP]: {
        //     default: false,
        //     inputType: 'checkbox',
        //     update: false
        // }
        [SETTINGS.SHOW_CROSS]: {
            default: true,
            inputType: 'checkbox',
            update: true
        },
        [SETTINGS.SHOW_DEMARCATIONS]: {
            default: true,
            inputType: 'checkbox',
            update: true
        },
        [SETTINGS.SHOW_BARBARIANS]: {
            default: false,
            inputType: 'checkbox',
            update: true
        },
        [SETTINGS.SHOW_GHOST_VILLAGES]: {
            default: false,
            inputType: 'checkbox',
            update: true
        },
        [SETTINGS.SHOW_ONLY_CUSTOM_HIGHLIGHTS]: {
            default: false,
            inputType: 'checkbox',
            update: true
        },
        [SETTINGS.HIGHLIGHT_OWN]: {
            default: true,
            inputType: 'checkbox',
            update: true
        },
        [SETTINGS.HIGHLIGHT_SELECTED]: {
            default: true,
            inputType: 'checkbox',
            update: true
        },
        [SETTINGS.HIGHLIGHT_DIPLOMACY]: {
            default: true,
            inputType: 'checkbox',
            update: true
        },
        [SETTINGS.COLOR_SELECTED]: {
            default: '#ffffff',
            inputType: 'color',
            update: true
        },
        [SETTINGS.COLOR_BARBARIAN]: {
            default: '#969696',
            inputType: 'color',
            update: true
        },
        [SETTINGS.COLOR_PLAYER]: {
            default: '#f0c800',
            inputType: 'color',
            update: true
        },
        [SETTINGS.COLOR_QUICK_HIGHLIGHT]: {
            default: '#ffffff',
            inputType: 'color',
            update: true
        },
        [SETTINGS.COLOR_BACKGROUND]: {
            default: '#436213',
            inputType: 'color',
            update: true
        },
        [SETTINGS.COLOR_PROVINCE]: {
            default: '#ffffff',
            inputType: 'color',
            update: true
        },
        [SETTINGS.COLOR_CONTINENT]: {
            default: '#cccccc',
            inputType: 'color',
            update: true
        },
        [SETTINGS.COLOR_CROSS]: {
            default: '#999999',
            inputType: 'color',
            update: true
        },
        [SETTINGS.COLOR_TRIBE]: {
            default: '#0000DB',
            inputType: 'color',
            update: true
        },
        [SETTINGS.COLOR_ALLY]: {
            default: '#00a0f4',
            inputType: 'color',
            update: true
        },
        [SETTINGS.COLOR_ENEMY]: {
            default: '#ED1212',
            inputType: 'color',
            update: true
        },
        [SETTINGS.COLOR_FRIENDLY]: {
            default: '#BF4DA4',
            inputType: 'color',
            update: true
        },
        [SETTINGS.COLOR_UGLY]: {
            default: '#A96534',
            inputType: 'color',
            update: true
        },
        [SETTINGS.COLOR_GHOST]: {
            default: '#3E551C',
            inputType: 'color',
            update: true
        }
    }
})

define('two/minimap/settings', [], function () {
    return {
        RIGHT_CLICK_ACTION: 'right_click_action',
        FLOATING_MINIMAP: 'floating_minimap',
        SHOW_CROSS: 'show_cross',
        SHOW_DEMARCATIONS: 'show_demarcations',
        SHOW_BARBARIANS: 'show_barbarians',
        SHOW_GHOST_VILLAGES: 'show_ghost_villages',
        SHOW_ONLY_CUSTOM_HIGHLIGHTS: 'show_only_custom_highlights',
        HIGHLIGHT_OWN: 'highlight_own',
        HIGHLIGHT_SELECTED: 'highlight_selected',
        HIGHLIGHT_DIPLOMACY: 'highlight_diplomacy',
        COLOR_GHOST: 'color_ghost',
        COLOR_QUICK_HIGHLIGHT: 'color_quick_highlight',
        COLOR_BACKGROUND: 'color_background',
        COLOR_PROVINCE: 'color_province',
        COLOR_CONTINENT: 'color_continent',
        COLOR_CROSS: 'color_cross'
    }
})

require([
    'helper/i18n',
    'two/ready',
    'two/minimap',
    'two/minimap/ui',
    'two/minimap/Events',
    'two/minimap/actionTypes',
    'two/minimap/settings',
    'two/minimap/settingsMap',
], function (
    i18n,
    ready,
    minimap,
    minimapInterface
) {
    if (minimap.initialized) {
        return false
    }

    var updateModuleLang = function () {
        var langs = {"en_us":{"minimap":{"minimap":"Minimap","highlights":"Highlights","add":"Add highlight","remove":"Remove highlight","placeholder_search":"Search player/tribe","highlight_add_success":"Highlight added","highlight_add_error":"Specify a highlight first","highlight_update_success":"Highlight updated","highlight_remove_success":"Highlight removed","highlight_villages":"Villages","highlight_players":"Players","highlight_tribes":"Tribes","highlight_add_error_exists":"Highlight already exists!","highlight_add_error_no_entry":"Select a player/tribe first!","highlight_add_error_invalid_color":"Invalid color!","village":"Village","player":"Player","tribe":"Tribe","color":"Color (Hex)","tooltip_pick_color":"Select a color","misc":"Miscellaneous settings","colors_misc":"Miscellaneous colors","colors_diplomacy":"Diplomacy colors","settings_saved":"Settings saved!","settings_right_click_action":"Village's right click action","highlight_village":"Highlight village","highlight_player":"Highlight player","highlight_tribe":"Highlight tribe","settings_show_floating_minimap":"Show floating minimap","settings_show_cross":"Show position cross","settings_show_demarcations":"Show province/continent demarcations","settings_show_barbarians":"Show barbarian villages","settings_show_ghost_villages":"Show non-loaded villages","settings_show_only_custom_highlights":"Show only custom highlights","settings_highlight_own":"Highlight own villages","settings_highlight_selected":"highlight selected village","settings_highlight_diplomacy":"Auto highlight tribe diplomacies","settings_colors_background":"Minimap background","settings_colors_province":"Province demarcation","settings_colors_continent":"Continent demarcation","settings_colors_quick_highlight":"Quick highlight","settings_colors_tribe":"Own tribe","settings_colors_player":"Own villages","settings_colors_selected":"Selected village","settings_colors_ghost":"Non-loaded villages","settings_colors_ally":"Ally","settings_colors_pna":"PNA","settings_colors_enemy":"Enemy","settings_colors_other":"Other","settings_colors_barbarian":"Barbarian","settings_colors_cross":"Position cross","settings_reset":"Settings reseted","tooltip_village":"Village","tooltip_village_points":"Village points","tooltip_player":"Player name","tooltip_player_points":"Player points","tooltip_tribe":"Tribe","tooltip_tribe_points":"Tribe points","tooltip_province":"Province name","no_highlights":"No highlights created","reset_confirm_title":"Reset settings","reset_confirm_text":"All settings gonna be reseted to the default settings.","reset_confirm_highlights_text":"Also, all highlights are going to be deleted."}},"pl_pl":{"minimap":{"minimap":"Kartograf","highlights":"Podświetlenie","add":"Dodaj podświetlenie","remove":"Usuń podświetlenie","placeholder_search":"gracz/plemie","highlight_add_success":"Podświetlenie dodane","highlight_add_error":"Najpierw sprecyzuj podświetlenie","highlight_update_success":"Podświetlenie zaktualizowane","highlight_remove_success":"Podświetlenie usunięte","highlight_villages":"Wioski","highlight_players":"Gracze","highlight_tribes":"Plemiona","highlight_add_error_exists":"Podświetlenie już istnieje!","highlight_add_error_no_entry":"Najpierw wybierz gracza/plemię!","highlight_add_error_invalid_color":"Nieprawidłowy kolor!","village":"Wioska","player":"Gracz","tribe":"Plemię","color":"Kolor (Hex)","tooltip_pick_color":"Select a color","misc":"Miscellaneous settings","colors_misc":"Miscellaneous colors","colors_diplomacy":"Diplomacy colors","settings_saved":"Settings saved!","settings_right_click_action":"Village's right click action","highlight_village":"Highlight village","highlight_player":"Highlight player","highlight_tribe":"Highlight tribe","settings_show_floating_minimap":"Show floating minimap","settings_show_cross":"Show position cross","settings_show_demarcations":"Show province/continent demarcations","settings_show_barbarians":"Show barbarian villages","settings_show_ghost_villages":"Show non-loaded villages","settings_show_only_custom_highlights":"Show only custom highlights","settings_highlight_own":"Highlight own villages","settings_highlight_selected":"highlight selected village","settings_highlight_diplomacy":"Auto highlight tribe diplomacies","settings_colors_background":"Minimap background","settings_colors_province":"Province demarcation","settings_colors_continent":"Continent demarcation","settings_colors_quick_highlight":"Quick highlight","settings_colors_tribe":"Own tribe","settings_colors_player":"Own villages","settings_colors_selected":"Selected village","settings_colors_ghost":"Non-loaded villages","settings_colors_ally":"Ally","settings_colors_pna":"PNA","settings_colors_enemy":"Enemy","settings_colors_other":"Other","settings_colors_barbarian":"Barbarian","settings_colors_cross":"Position cross","settings_reset":"Settings reseted","tooltip_village":"Village","tooltip_village_points":"Village points","tooltip_player":"Player name","tooltip_player_points":"Player points","tooltip_tribe":"Tribe","tooltip_tribe_points":"Tribe points","tooltip_province":"Province name","no_highlights":"No highlights created","reset_confirm_title":"Reset settings","reset_confirm_text":"All settings gonna be reseted to the default settings.","reset_confirm_highlights_text":"Also, all highlights are going to be deleted."}},"pt_br":{"minimap":{"minimap":"Minimapa","highlights":"Marcações","add":"Adicionar marcação","remove":"Remover marcação","placeholder_search":"Procurar jogador/tribo","highlight_add_success":"Marcação adicionada","highlight_add_error":"Especifique uma marcação primeiro","highlight_update_success":"Marcação atualizada","highlight_remove_success":"Marcação removida","highlight_villages":"Aldeias","highlight_players":"Jogadores","highlight_tribes":"Tribos","highlight_add_error_exists":"Marcação já existe!","highlight_add_error_no_entry":"Selecione uma jogador/tribo primeiro!","highlight_add_error_invalid_color":"Cor inválida!","village":"Aldeia","player":"Jogador","tribe":"Tribo","color":"Cor (Hex)","tooltip_pick_color":"Selecione uma cor","misc":"Configurações diversas","colors_misc":"Cores diversas","colors_diplomacy":"Cores da diplomacia","settings_saved":"Configurações salvas!","settings_right_click_action":"Ação de clique direito na aldeia","highlight_village":"Marcar aldeia","highlight_player":"Marcar jogador","highlight_tribe":"Marcar tribo","settings_show_floating_minimap":"Mostrar minimapa flutuante","settings_show_cross":"Mostrar marcação da posição atual","settings_show_demarcations":"Mostrar demarcações das provincias/continentes","settings_show_barbarians":"Mostrar aldeias bárbaras","settings_show_ghost_villages":"Mostrar aldeias não carregadas","settings_show_only_custom_highlights":"Mostrar apenas marcações manuais","settings_highlight_own":"Marcar próprias aldeias","settings_highlight_selected":"Marcar aldeia selecionada","settings_highlight_diplomacy":"Marcação automática baseado na diplomacia","settings_colors_background":"Fundo do minimapa","settings_colors_province":"Demarcação da provincia","settings_colors_continent":"Demarcação do continente","settings_colors_quick_highlight":"Marcação rápida","settings_colors_tribe":"Própria tribo","settings_colors_player":"Aldeias próprias","settings_colors_selected":"Aldeia selecionada","settings_colors_ghost":"Aldeias não carregadas","settings_colors_ally":"Aliados","settings_colors_pna":"PNA","settings_colors_enemy":"Inimigos","settings_colors_other":"Outros","settings_colors_barbarian":"Aldeias Bárbaras","settings_colors_cross":"Cruz da posição","settings_reset":"Configurações resetadas","tooltip_village":"Aldeia","tooltip_village_points":"Pontos da aldeia","tooltip_player":"Nome do jogador","tooltip_player_points":"Pontos do jogador","tooltip_tribe":"Nome da Tribo","tooltip_tribe_points":"Pontos da tribo","tooltip_province":"Nome da província","no_highlights":"Nenhuma marcação criada","reset_confirm_title":"Resetar configurações","reset_confirm_text":"Todas as configurações serão resetas para as configurações padrões.","reset_confirm_highlights_text":"Todas marcações também serão deletadas"}}}
        var current = $rootScope.loc.ale
        var data = current in langs
            ? langs[current]
            : langs['en_us']

        i18n.setJSON(data)
    }

    ready(function () {
        updateModuleLang()
        minimap.init()
        minimapInterface()
        minimap.run()
    })
})

define('two/minimap/ui', [
    'two/minimap',
    'two/minimap/actionTypes',
    'two/minimap/settingsMap',
    'two/minimap/settings',
    'two/ui2',
    'two/ui/autoComplete',
    'two/FrontButton',
    'two/utils',
    'helper/util',
    'queues/EventQueue',
    'struct/MapData',
    'cdn',
    'two/EventScope',
    'conf/colors',
], function (
    minimap,
    ACTION_TYPES,
    SETTINGS_MAP,
    SETTINGS,
    interfaceOverflow,
    autoComplete,
    FrontButton,
    utils,
    util,
    eventQueue,
    $mapData,
    cdn,
    EventScope,
    colors
) {
    var $scope
    var textObject = 'minimap'
    var textObjectCommon = 'common'
    var TAB_TYPES = {
        MINIMAP: 'minimap',
        HIGHLIGHTS: 'highlights',
        SETTINGS: 'settings'
    }
    var DEFAULT_TAB = TAB_TYPES.MINIMAP
    var $minimapCanvas
    var $crossCanvas
    var $minimapContainer
    var actionTypes = []
    var selectedActionType = {}
    var MapController
    var tooltipWrapper
    var windowWrapper
    var mapWrapper
    var tooltipWrapperSpacer = {}
    var tooltipTimeout
    var highlightNames = {
        character: {},
        tribe: {}
    }

    var selectTab = function (tab) {
        $scope.selectedTab = tab

        if (tab === TAB_TYPES.MINIMAP) {
            minimap.enableRendering()
        } else {
            minimap.disableRendering()
        }
    }

    var appendCanvas = function () {
        $minimapContainer = document.querySelector('#two-minimap .minimap-container')
        $minimapContainer.appendChild($minimapCanvas)
        $minimapContainer.appendChild($crossCanvas)
    }

    var getTribeData = function (data, callback) {
        socketService.emit(routeProvider.TRIBE_GET_PROFILE, {
            tribe_id: data.id
        }, callback)
    }
    
    var getCharacterData = function (data, callback) {
        socketService.emit(routeProvider.CHAR_GET_PROFILE, {
            character_id: data.id
        }, callback)
    }

    var getVillageData = function (data, callback) {
        $mapData.loadTownDataAsync(data.x, data.y, 1, 1, callback)
    }

    var updateHighlightNames = function () {
        Object.keys($scope.highlights.character).forEach(function (id) {
            if (id in highlightNames.character) {
                return
            }

            getCharacterData({
                id: id
            }, function (data) {
                highlightNames.character[id] = data.character_name
            })
        })

        Object.keys($scope.highlights.tribe).forEach(function (id) {
            if (id in highlightNames.tribe) {
                return
            }

            getTribeData({
                id: id
            }, function (data) {
                highlightNames.tribe[id] = data.name
            })
        })
    }

    var showTooltip = function (_, data) {
        tooltipTimeout = setTimeout(function () {
            var windowOffset
            var tooltipOffset
            var onTop
            var onLeft

            windowWrapper.appendChild(tooltipWrapper)
            tooltipWrapper.classList.remove('ng-hide')

            MapController.tt.name = data.village.name
            MapController.tt.x = data.village.x
            MapController.tt.y = data.village.y
            MapController.tt.province_name = data.village.province_name
            MapController.tt.points = data.village.points
            MapController.tt.character_name = data.village.character_name || '-'
            MapController.tt.character_points = data.village.character_points || 0
            MapController.tt.tribe_name = data.village.tribe_name || '-'
            MapController.tt.tribe_tag = data.village.tribe_tag || '-'
            MapController.tt.tribe_points = data.village.tribe_points || 0
            MapController.tt.morale = data.village.morale || 0
            MapController.tt.position = {}
            MapController.tt.position.x = data.event.pageX + 50
            MapController.tt.position.y = data.event.pageY + 50
            MapController.tt.visible = true

            tooltipOffset = tooltipWrapper.getBoundingClientRect()
            windowOffset = windowWrapper.getBoundingClientRect()
            tooltipWrapperSpacer.x = tooltipOffset.width + 50
            tooltipWrapperSpacer.y = tooltipOffset.height + 50

            onTop = MapController.tt.position.y + tooltipWrapperSpacer.y > windowOffset.top + windowOffset.height
            onLeft = MapController.tt.position.x + tooltipWrapperSpacer.x > windowOffset.width

            if (onTop) {
                MapController.tt.position.y -= 50
            }

            tooltipWrapper.classList.toggle('left', onLeft)
            tooltipWrapper.classList.toggle('top', onTop)
        }, 50)
    }

    var hideTooltip = function () {
        clearTimeout(tooltipTimeout)
        MapController.tt.visible = false
        tooltipWrapper.classList.add('ng-hide')
        mapWrapper.appendChild(tooltipWrapper)
    }

    var openColorPalette = function (inputType, colorGroup, itemId, itemColor) {
        var modalScope = $rootScope.$new()
        var selectedColor
        var hideReset = true
        var settingId

        modalScope.colorPalettes = colors.palette

        if (inputType === 'setting') {
            settingId = colorGroup
            selectedColor = $scope.settings[settingId]
            hideReset = false

            modalScope.submit = function () {
                $scope.settings[settingId] = '#' + modalScope.selectedColor
                modalScope.closeWindow()
            }

            modalScope.reset = function () {
                $scope.settings[settingId] = SETTINGS_MAP[settingId].default
                modalScope.closeWindow()
            }
        } else if (inputType === 'add_custom_highlight') {
            selectedColor = $scope.addHighlightColor

            modalScope.submit = function () {
                $scope.addHighlightColor = '#' + modalScope.selectedColor
                modalScope.closeWindow()
            }
        } else if (inputType === 'edit_custom_highlight') {
            selectedColor = $scope.highlights[colorGroup][itemId]

            modalScope.submit = function () {
                minimap.addHighlight({
                    id: itemId,
                    type: colorGroup
                }, '#' + modalScope.selectedColor)
                modalScope.closeWindow()
            }
        }

        modalScope.selectedColor = selectedColor.replace('#', '')
        modalScope.hasCustomColors = true
        modalScope.hideReset = hideReset

        modalScope.finishAction = function ($event, color) {
            modalScope.selectedColor = color
        }

        windowManagerService.getModal('modal_color_palette', modalScope)
    }

    var addCustomHighlight = function () {
        minimap.addHighlight($scope.selectedHighlight, $scope.addHighlightColor)
    }

    var saveSettings = function () {
        var settingsCopy = angular.copy($scope.settings)
        settingsCopy[SETTINGS.RIGHT_CLICK_ACTION] = settingsCopy[SETTINGS.RIGHT_CLICK_ACTION].value
        minimap.updateSettings(settingsCopy)
    }

    var parseSettings = function (rawSettings) {
        var settings = angular.copy(rawSettings)

        settings[SETTINGS.RIGHT_CLICK_ACTION] = {
            value: settings[SETTINGS.RIGHT_CLICK_ACTION],
            name: $filter('i18n')(settings[SETTINGS.RIGHT_CLICK_ACTION], $rootScope.loc.ale, textObject)
        }

        return settings
    }

    var resetSettings = function () {
        var modalScope = $rootScope.$new()

        modalScope.title = $filter('i18n')('reset_confirm_title', $rootScope.loc.ale, textObject)
        modalScope.text = $filter('i18n')('reset_confirm_text', $rootScope.loc.ale, textObject)
        modalScope.submitText = $filter('i18n')('reset', $rootScope.loc.ale, textObjectCommon)
        modalScope.cancelText = $filter('i18n')('cancel', $rootScope.loc.ale, textObjectCommon)
        modalScope.showQuestionMarkIcon = true
        modalScope.switchColors = true

        modalScope.submit = function submit() {
            minimap.resetSettings()
            modalScope.closeWindow()
        }

        modalScope.cancel = function cancel() {
            modalScope.closeWindow()
        }

        windowManagerService.getModal('modal_attention', modalScope)
    }

    var highlightsCount = function () {
        var character = Object.keys($scope.highlights.character).length
        var tribe = Object.keys($scope.highlights.tribe).length
        
        return character + tribe
    }

    var openProfile = function (type, itemId) {
        var handler = type === 'character'
            ? windowDisplayService.openCharacterProfile
            : windowDisplayService.openTribeProfile

        handler(itemId)
    }

    var eventHandlers = {
        addHighlightAutoCompleteSelect: function (item) {
            $scope.selectedHighlight = {
                id: item.id,
                type: item.type,
                name: item.name
            }
        },
        settingsReset: function () {
            $scope.settings = parseSettings(minimap.getSettings())

            utils.emitNotif('success', $filter('i18n')('settings_reset', $rootScope.loc.ale, textObject))
        },
        settingsSave: function () {
            utils.emitNotif('success', $filter('i18n')('settings_saved', $rootScope.loc.ale, textObject))
        },
        highlightUpdate: function (event) {
            updateHighlightNames()
        },
        highlightAddErrorExists: function (event) {
            utils.emitNotif('error', $filter('i18n')('highlight_add_error_exists', $rootScope.loc.ale, textObject))
        },
        highlightAddErrorNoEntry: function (event) {
            utils.emitNotif('error', $filter('i18n')('highlight_add_error_no_entry', $rootScope.loc.ale, textObject))
        },
        highlightAddErrorInvalidColor: function (event) {
            utils.emitNotif('error', $filter('i18n')('highlight_add_error_invalid_color', $rootScope.loc.ale, textObject))
        },
        onMouseLeaveMinimap: function (event) {
            var event = new MouseEvent('mouseup', {
                view: window,
                bubbles: true,
                cancelable: true
            })

            hideTooltip()
            $crossCanvas.dispatchEvent(event)
        },
        onMouseMoveMinimap: function (event) {
            hideTooltip()
            $crossCanvas.style.cursor = 'url(' + cdn.getPath('/img/cursor/grab_pushed.png') + '), move'
        },
        onMouseStopMoveMinimap: function (event) {
            $crossCanvas.style.cursor = ''
        }
    }

    var init = function () {
        var id
        var opener

        MapController = transferredSharedDataService.getSharedData('MapController')
        $minimapCanvas = document.createElement('canvas')
        $minimapCanvas.className = 'minimap'
        $crossCanvas = document.createElement('canvas')
        $crossCanvas.className = 'cross'

        minimap.setViewport($minimapCanvas)
        minimap.setCross($crossCanvas)

        tooltipWrapper = document.querySelector('#map-tooltip')
        windowWrapper = document.querySelector('#wrapper')
        mapWrapper = document.querySelector('#map')

        for (id in ACTION_TYPES) {
            actionTypes.push({
                value: ACTION_TYPES[id],
                name: $filter('i18n')(ACTION_TYPES[id], $rootScope.loc.ale, textObject)
            })
        }

        opener = new FrontButton('Minimap', {
            classHover: false,
            classBlur: false,
            onClick: function () {
                var current = minimap.getMapPosition()

                if (!current) {
                    return false
                }

                minimap.setCurrentPosition(current[0], current[1])
                buildWindow()
            }
        })

        interfaceOverflow.addTemplate('twoverflow_minimap_window', `<div id="two-minimap" class="win-content two-window"><header class="win-head"><h2>Minimap</h2><ul class="list-btn"><li><a href="#" class="size-34x34 btn-red icon-26x26-close" ng-click="closeWindow()"></a></li></ul></header><div class="win-main small-select" scrollbar=""><div class="tabs tabs-bg"><div class="tabs-three-col"><div class="tab" ng-click="selectTab(TAB_TYPES.MINIMAP)" ng-class="{'tab-active': selectedTab == TAB_TYPES.MINIMAP}"><div class="tab-inner"><div ng-class="{'box-border-light': selectedTab === TAB_TYPES.MINIMAP}"><a href="#" ng-class="{'btn-icon btn-orange': selectedTab !== TAB_TYPES.MINIMAP}">{{ 'minimap' | i18n:loc.ale:textObject }}</a></div></div></div><div class="tab" ng-click="selectTab(TAB_TYPES.HIGHLIGHTS)" ng-class="{'tab-active': selectedTab == TAB_TYPES.HIGHLIGHTS}"><div class="tab-inner"><div ng-class="{'box-border-light': selectedTab === TAB_TYPES.HIGHLIGHTS}"><a href="#" ng-class="{'btn-icon btn-orange': selectedTab !== TAB_TYPES.HIGHLIGHTS}">{{ 'highlights' | i18n:loc.ale:textObject }}</a></div></div></div><div class="tab" ng-click="selectTab(TAB_TYPES.SETTINGS)" ng-class="{'tab-active': selectedTab == TAB_TYPES.SETTINGS}"><div class="tab-inner"><div ng-class="{'box-border-light': selectedTab === TAB_TYPES.SETTINGS}"><a href="#" ng-class="{'btn-icon btn-orange': selectedTab !== TAB_TYPES.SETTINGS}">{{ 'settings' | i18n:loc.ale:textObjectCommon }}</a></div></div></div></div></div><div ng-show="selectedTab === TAB_TYPES.MINIMAP" class="minimap-container"></div><div class="box-paper" ng-class="{'footer': selectedTab == TAB_TYPES.SETTINGS}"><div class="scroll-wrap"><div ng-show="selectedTab == TAB_TYPES.HIGHLIGHTS"><h5 class="twx-section">{{ 'add' | i18n:loc.ale:textObject }}</h5><table class="tbl-border-light tbl-striped add-highlight"><colgroup><col width="40%"><col><col width="4%"><col width="4%"></colgroup><tbody><tr><td><div auto-complete="autoComplete"></div></td><td class="text-center"><span ng-show="selectedHighlight" class="icon-26x26-rte-{{ selectedHighlight.type }}"></span> {{ selectedHighlight.name }}</td><td><div class="color-container box-border-dark" ng-click="openColorPalette('add_custom_highlight')" ng-style="{'background-color': addHighlightColor }" tooltip="" tooltip-content="{{ 'tooltip_pick_color' | i18n:loc.ale:textObject }}"></div></td><td><span class="btn-orange icon-26x26-plus" ng-click="addCustomHighlight()" tooltip="" tooltip-content="{{ 'add' | i18n:loc.ale:textObject }}"></span></td></tr></tbody></table><h5 class="twx-section">{{ TAB_TYPES.HIGHLIGHTS | i18n:loc.ale:textObject }}</h5><p class="text-center" ng-show="!highlightsCount()">{{ 'no_highlights' | i18n:loc.ale:textObject }}</p><table class="tbl-border-light tbl-striped" ng-show="highlightsCount()"><colgroup><col width="4%"><col><col width="4%"><col width="4%"></colgroup><tbody><tr ng-repeat="(id, color) in highlights.character"><td><span class="icon-26x26-rte-character"></span></td><td><span class="open-profile" ng-click="openProfile('character', id)">{{ highlightNames.character[id] }}</span></td><td><div class="color-container box-border-dark" ng-click="openColorPalette('edit_custom_highlight', 'character', id)" ng-style="{'background-color': color }"></div></td><td><a class="size-26x26 btn-red icon-20x20-close" ng-click="removeHighlight('character', id)" tooltip="" tooltip-content="{{ 'remove' | i18n:loc.ale:textObject }}"></a></td></tr><tr ng-repeat="(id, color) in highlights.tribe"><td><span class="icon-26x26-rte-tribe"></span></td><td><span class="open-profile" ng-click="openProfile('tribe', id)">{{ highlightNames.tribe[id] }}</span></td><td><div class="color-container box-border-dark" ng-click="openColorPalette('edit_custom_highlight', 'tribe', id)" ng-style="{'background-color': color }"></div></td><td><a class="size-26x26 btn-red icon-20x20-close" ng-click="removeHighlight('tribe', id)" tooltip="" tooltip-content="{{ 'remove' | i18n:loc.ale:textObject }}"></a></td></tr></tbody></table></div><div ng-show="selectedTab == TAB_TYPES.SETTINGS"><table class="tbl-border-light tbl-striped"><colgroup><col width="60%"><col><col width="56px"></colgroup><tbody><tr><th colspan="3">{{ 'misc' | i18n:loc.ale:textObject }}</th></tr><tr><td>{{ 'settings_right_click_action' | i18n:loc.ale:textObject }}</td><td colspan="3"><div select="" list="actionTypes" selected="settings[SETTINGS.RIGHT_CLICK_ACTION]" drop-down="true"></div></td></tr><tr><td colspan="2">{{ 'settings_show_cross' | i18n:loc.ale:textObject }}</td><td><div switch-slider="" value="settings[SETTINGS.SHOW_CROSS]" vertical="false" size="'56x28'" enabled="true"></div></td></tr><tr><td colspan="2">{{ 'settings_show_demarcations' | i18n:loc.ale:textObject }}</td><td><div switch-slider="" value="settings[SETTINGS.SHOW_DEMARCATIONS]" vertical="false" size="'56x28'" enabled="true"></div></td></tr><tr><td colspan="2">{{ 'settings_show_barbarians' | i18n:loc.ale:textObject }}</td><td><div switch-slider="" value="settings[SETTINGS.SHOW_BARBARIANS]" vertical="false" size="'56x28'" enabled="true"></div></td></tr><tr><td colspan="2">{{ 'settings_show_ghost_villages' | i18n:loc.ale:textObject }}</td><td><div switch-slider="" value="settings[SETTINGS.SHOW_GHOST_VILLAGES]" vertical="false" size="'56x28'" enabled="true"></div></td></tr><tr><td colspan="2">{{ 'settings_show_only_custom_highlights' | i18n:loc.ale:textObject }}</td><td><div switch-slider="" value="settings[SETTINGS.SHOW_ONLY_CUSTOM_HIGHLIGHTS]" vertical="false" size="'56x28'" enabled="true"></div></td></tr><tr><td colspan="2">{{ 'settings_highlight_own' | i18n:loc.ale:textObject }}</td><td><div switch-slider="" value="settings[SETTINGS.HIGHLIGHT_OWN]" vertical="false" size="'56x28'" enabled="true"></div></td></tr><tr><td colspan="2">{{ 'settings_highlight_selected' | i18n:loc.ale:textObject }}</td><td><div switch-slider="" value="settings[SETTINGS.HIGHLIGHT_SELECTED]" vertical="false" size="'56x28'" enabled="true"></div></td></tr><tr><td colspan="2">{{ 'settings_highlight_diplomacy' | i18n:loc.ale:textObject }}</td><td><div switch-slider="" value="settings[SETTINGS.HIGHLIGHT_DIPLOMACY]" vertical="false" size="'56x28'" enabled="true"></div></td></tr></tbody></table><table class="tbl-border-light tbl-striped"><colgroup><col><col width="29px"></colgroup><tbody><tr><th colspan="2">{{ 'colors_misc' | i18n:loc.ale:textObject }}</th></tr><tr><td>{{ 'settings_colors_background' | i18n:loc.ale:textObject }}</td><td><div class="color-container box-border-dark" ng-click="openColorPalette('setting', SETTINGS.COLOR_BACKGROUND)" ng-style="{'background-color': settings[SETTINGS.COLOR_BACKGROUND] }"></div></td></tr><tr><td>{{ 'settings_colors_province' | i18n:loc.ale:textObject }}</td><td><div class="color-container box-border-dark" ng-click="openColorPalette('setting', SETTINGS.COLOR_PROVINCE)" ng-style="{'background-color': settings[SETTINGS.COLOR_PROVINCE] }"></div></td></tr><tr><td>{{ 'settings_colors_continent' | i18n:loc.ale:textObject }}</td><td><div class="color-container box-border-dark" ng-click="openColorPalette('setting', SETTINGS.COLOR_CONTINENT)" ng-style="{'background-color': settings[SETTINGS.COLOR_CONTINENT] }"></div></td></tr><tr><td>{{ 'settings_colors_cross' | i18n:loc.ale:textObject }}</td><td><div class="color-container box-border-dark" ng-click="openColorPalette('setting', SETTINGS.COLOR_CROSS)" ng-style="{'background-color': settings[SETTINGS.COLOR_CROSS] }"></div></td></tr><tr><td>{{ 'settings_colors_quick_highlight' | i18n:loc.ale:textObject }}</td><td><div class="color-container box-border-dark" ng-click="openColorPalette('setting', SETTINGS.COLOR_QUICK_HIGHLIGHT)" ng-style="{'background-color': settings[SETTINGS.COLOR_QUICK_HIGHLIGHT] }"></div></td></tr><tr><td>{{ 'settings_colors_ghost' | i18n:loc.ale:textObject }}</td><td><div class="color-container box-border-dark" ng-click="openColorPalette('setting', SETTINGS.COLOR_GHOST)" ng-style="{'background-color': settings[SETTINGS.COLOR_GHOST] }"></div></td></tr></tbody></table></div></div></div></div><footer class="win-foot" ng-show="selectedTab === TAB_TYPES.SETTINGS"><ul class="list-btn list-center"><li><a href="#" class="btn-border btn-red" ng-click="resetSettings()">{{ 'reset' | i18n:loc.ale:textObjectCommon }}</a></li><li><a href="#" class="btn-border btn-green" ng-click="saveSettings()">{{ 'save' | i18n:loc.ale:textObjectCommon }}</a></li></ul></footer></div>`)
        interfaceOverflow.addStyle('#map-tooltip{z-index:1000}#two-minimap .minimap{position:absolute;left:0;top:38px;z-index:5}#two-minimap .cross{position:absolute;left:0;top:38px;z-index:6}#two-minimap .box-paper:not(.footer) .scroll-wrap{margin-bottom:40px}#two-minimap span.select-wrapper{width:100%}#two-minimap .add-highlight input{width:100%}#two-minimap .open-profile:hover{font-weight:bold;text-shadow:-1px 1px 0 #e0cc97}')
    }

    var buildWindow = function () {
        $scope = $rootScope.$new()
        $scope.textObject = textObject
        $scope.textObjectCommon = textObjectCommon
        $scope.SETTINGS = SETTINGS
        $scope.TAB_TYPES = TAB_TYPES
        $scope.selectedTab = DEFAULT_TAB
        $scope.selectedHighlight = false
        $scope.addHighlightColor = '#000000'
        $scope.highlights = minimap.getHighlights()
        $scope.highlightNames = highlightNames
        $scope.settings = parseSettings(minimap.getSettings())
        $scope.actionTypes = actionTypes
        $scope.autoComplete = {
            type: ['character', 'tribe', 'village'],
            placeholder: $filter('i18n')('placeholder_search', $rootScope.loc.ale, textObject),
            onEnter: eventHandlers.addHighlightAutoCompleteSelect
        }

        // functions
        $scope.selectTab = selectTab
        $scope.openColorPalette = openColorPalette
        $scope.addCustomHighlight = addCustomHighlight
        $scope.removeHighlight = minimap.removeHighlight
        $scope.saveSettings = saveSettings
        $scope.resetSettings = resetSettings
        $scope.highlightsCount = highlightsCount
        $scope.openProfile = openProfile

        eventScope = new EventScope('twoverflow_minimap_window')
        eventScope.register(eventTypeProvider.MINIMAP_SETTINGS_RESET, eventHandlers.settingsReset)
        eventScope.register(eventTypeProvider.MINIMAP_SETTINGS_SAVE, eventHandlers.settingsSave)
        eventScope.register(eventTypeProvider.GROUPS_VILLAGES_CHANGED, eventHandlers.highlightUpdate, true)
        eventScope.register(eventTypeProvider.MINIMAP_HIGHLIGHT_ADD_ERROR_EXISTS, eventHandlers.highlightAddErrorExists)
        eventScope.register(eventTypeProvider.MINIMAP_HIGHLIGHT_ADD_ERROR_NO_ENTRY, eventHandlers.highlightAddErrorNoEntry)
        eventScope.register(eventTypeProvider.MINIMAP_HIGHLIGHT_ADD_ERROR_INVALID_COLOR, eventHandlers.highlightAddErrorInvalidColor)
        eventScope.register(eventTypeProvider.MINIMAP_VILLAGE_HOVER, showTooltip)
        eventScope.register(eventTypeProvider.MINIMAP_VILLAGE_BLUR, hideTooltip)
        eventScope.register(eventTypeProvider.MINIMAP_MOUSE_LEAVE, eventHandlers.onMouseLeaveMinimap)
        eventScope.register(eventTypeProvider.MINIMAP_START_MOVE, eventHandlers.onMouseMoveMinimap)
        eventScope.register(eventTypeProvider.MINIMAP_STOP_MOVE, eventHandlers.onMouseStopMoveMinimap)

        windowManagerService.getScreenWithInjectedScope('!twoverflow_minimap_window', $scope)
        updateHighlightNames()
        appendCanvas()
        minimap.enableRendering()
    }

    return init
})

define('two/ui2', [
    'conf/conf',
    'conf/cdn'
], function (
    conf,
    cdnConf
) {
    var interfaceOverflow = {}
    var templates = {}

    var $head = document.querySelector('head')
    var httpService = injector.get('httpService')
    var templateManagerService = injector.get('templateManagerService')
    var $templateCache = injector.get('$templateCache')

    templateManagerService.load = function (templateName, onSuccess, opt_onError) {
        var path

        var success = function (data, status, headers, config) {
            $templateCache.put(path.substr(1), data)

            if (angular.isFunction(onSuccess)) {
                onSuccess(data, status, headers, config)
            }

            if (!$rootScope.$$phase) {
                $rootScope.$apply()
            }
        }
        var error = function (data, status, headers, config) {
            if (angular.isFunction(opt_onError)) {
                opt_onError(data, status, headers, config)
            }
        }

        if (0 !== templateName.indexOf('!')) {
            path = conf.TEMPLATE_PATH_EXT.join(templateName)
        } else {
            path = templateName.substr(1)
        }

        if ($templateCache.get(path.substr(1))) {
            success($templateCache.get(path.substr(1)), 304)
        } else {
            if (cdnConf.versionMap[path]) {
                httpService.get(path, success, error)
            } else {
                success(templates[path], 304)
            }
        }
    }

    interfaceOverflow.addTemplate = function (path, data) {
        templates[path] = data
    }

    interfaceOverflow.addStyle = function (styles) {
        var $style = document.createElement('style')
        $style.type = 'text/css'
        $style.appendChild(document.createTextNode(styles))
        $head.appendChild($style)
    }

    return interfaceOverflow
})

define('two/ui/autoComplete', [
    'two/utils',
    'helper/dom',
    'struct/MapData'
], function (
    utils,
    domHelper,
    $mapData
) {
    /**
     * Auto-complete identification used to filter events from
     * eventTypeProvider.SELECT_SELECTED and receive the data.
     *
     * @type {String}
     */
    var id = 'two-autocomplete'

    /**
     * Identify if the Auto-complete element is visible.
     * Used to hide the element if a click outside the select
     * is detected.
     *
     * @type {Boolean}
     */
    var visible = false

    /**
     * Detect clicks outside the Auto-complete select element and hide it.
     *
     * @param {Object} event - Click event.
     */
    var hideClick = function (event) {
        var elem = event.srcElement || event.target

        if (!utils.matchesElem(elem, '.custom-select')) {
            autoComplete.hide()
        }
    }

    /**
     * Handle the events when a option is selected.
     *
     * @param {Object} data - Data of the selected item.
     */
    var onSelect = function (data, args) {
        autoComplete.hide()
        $rootScope.$broadcast(eventTypeProvider.SELECT_HIDE, id)
        $rootScope.$broadcast(eventTypeProvider.SELECT_SELECTED, id, data, args)
    }

    /**
     * autoComplete public methods.
     *
     * @type {Object}
     */
    var autoComplete = {}

    /**
     * Hide Auto-complete select element.
     */
    autoComplete.hide = function () {
        $rootScope.$broadcast(eventTypeProvider.SELECT_HIDE, id)

        $(window).off('click', hideClick)
        $('.win-main').off('mousewheel', autoComplete.hide)

        visible = false
    }

    /**
     * Display the Auto-complete element.
     *
     * @param {Object} data - Object generated by routeProvider.AUTOCOMPLETE
     * @param {Element} $elem - Element where the select will show up next to.
     * @param {String} selectId - AutoComplete unique identification.
     * @param {Any=} args - Custom value.
     *
     * @return {Boolean} !!autocomplete-showed
     */
    autoComplete.show = function show (data, $elem, selectId, args) {
        id = selectId

        if (!data.length) {
            return false
        }

        $rootScope.$broadcast(
            eventTypeProvider.SELECT_SHOW,
            id,
            data,
            null,
            function (data) {
                onSelect(data, args)
            },
            $elem,
            true,
            0,
            $filter('i18n')('no-results', $rootScope.loc.ale, 'common')
        )

        if (!visible) {
            visible = true

            $('.win-main').on('mousewheel', autoComplete.hide)
            $(window).on('click', hideClick)
        }

        return true
    }

    /**
     * Search village/character/tribe by coords/name/tag.
     *
     * @param {String} Coords/name/tag.
     * @param {Function} callback
     * @param {Array=} types - Types of items to be searched:
     *   village, character or tribe.
     * @param {Number=} amount - Limit the amount of returned items.
     */
    autoComplete.search = function (value, callback, types, amount) {
        var results = []

        if (utils.isValidCoords(value)) {
            var coords = value.split('|').map(function (coord) {
                return parseInt(coord, 10)
            })

            $mapData.loadTownDataAsync(coords[0], coords[1], 1, 1, function (village) {
                if (village) {
                    results.push({
                        id: village.id,
                        type: 'village',
                        name: utils.genVillageLabel(village),
                        raw: village
                    })
                }

                callback(results)
            })

            return
        }

        socketService.emit(routeProvider.AUTOCOMPLETE, {
            types: types || ['village', 'character', 'tribe'],
            string: value,
            amount: amount || 5
        }, function (data) {
            for (var type in data.result) {
                data.result[type].forEach(function (item, i) {
                    if (type === 'village') {
                        item.raw = angular.copy(item)
                        item.name = utils.genVillageLabel(item)
                    }

                    item.type = type
                    item.leftIcon = 'size-34x34 icon-26x26-rte-' + type


                    results.push(item)
                })
            }

            callback(results)
        })
    }

    return autoComplete
})

define('two/FrontButton', [], function () {
    function FrontButton (label, options) {
        this.options = options = angular.merge({
            label: label,
            className: '',
            classHover: 'expand-button',
            classBlur: 'contract-button',
            tooltip: false,
            onClick: function() {}
        }, options)

        this.buildWrapper()
        this.appendButton()

        var $elem = this.$elem

        var $label = $elem.querySelector('.label')
        var $quick = $elem.querySelector('.quickview')

        if (options.classHover) {
            $elem.addEventListener('mouseenter', function () {
                $elem.classList.add(options.classHover)
                $elem.classList.remove(options.classBlur)

                // $label.hide()
                $label.style.display = 'none'
                // $quick.show()
                $quick.style.display = ''
            })
        }

        if (options.classBlur) {
            $elem.addEventListener('mouseleave', function () {
                $elem.classList.add(options.classBlur)
                $elem.classList.remove(options.classHover)

                // $quick.hide()
                $quick.style.display = 'none'
                // $label.show()
                $label.style.display = ''
            })
        }

        if (options.tooltip) {
            $elem.addEventListener('mouseenter', function (event) {
                $rootScope.$broadcast(
                    eventTypeProvider.TOOLTIP_SHOW,
                    'twoverflow-tooltip',
                    options.tooltip,
                    true,
                    event
                )
            })

            $elem.addEventListener('mouseleave', function () {
                $rootScope.$broadcast(eventTypeProvider.TOOLTIP_HIDE, 'twoverflow-tooltip')
            })
        }

        if (options.onClick) {
            $elem.addEventListener('click', options.onClick)
        }

        return this
    }

    FrontButton.prototype.updateQuickview = function (text) {
        this.$elem.querySelector('.quickview').innerHTML = text
    }

    FrontButton.prototype.hover = function (handler) {
        this.$elem.addEventListener('mouseenter', handler)
    }

    FrontButton.prototype.click = function (handler) {
        this.$elem.addEventListener('click', handler)
    }

    FrontButton.prototype.buildWrapper = function () {
        var $wrapper = document.getElementById('two-bar')

        if (!$wrapper) {
            $wrapper = document.createElement('div')
            $wrapper.id = 'two-bar'
            document.querySelector('#wrapper').appendChild($wrapper)
        }

        this.$wrapper = $wrapper
    }

    FrontButton.prototype.appendButton = function () {
        var $container = document.createElement('div')
        $container.innerHTML = '<div class="btn-border btn-green button ' + this.options.className + '"><div class="top-left"></div><div class="top-right"></div><div class="middle-top"></div><div class="middle-bottom"></div><div class="middle-left"></div><div class="middle-right"></div><div class="bottom-left"></div><div class="bottom-right"></div><div class="label">' + this.options.label + '</div><div class="quickview"></div></div>'
        var $elem = $container.children[0]

        this.$wrapper.appendChild($elem)
        this.$elem = $elem
    }

    FrontButton.prototype.destroy = function () {
        this.$elem.remove()
    }

    return FrontButton
})

require([
    'two/ui2'
], function (
    interfaceOverflow
) {
    interfaceOverflow.addStyle('.two-window a.select-handler{-webkit-box-shadow:none;box-shadow:none}.two-window .small-select a.select-handler{height:22px;line-height:22px}.two-window .small-select a.select-button{height:22px}.two-window input::placeholder{color:rgba(255,243,208,0.7)}.two-window .green{color:#07770b}.two-window .red{color:#770707}.two-window .blue{color:#074677}#toolbar-left{height:calc(100% - 358px) !important;top:250px !important}#two-bar{position:absolute;top:110px;left:5px;margin-bottom:7px;z-index:10;width:100px}#two-bar .button{white-space:nowrap;position:relative;top:-17px;left:0px;min-width:70px;height:24px;padding:0 3px}#two-bar .label,#two-bar .quickview{margin:5px 0;font-size:12px}#two-bar .quickview{display:none}#wrapper.window-open #two-bar .button{left:715px}')
})

})(this)
