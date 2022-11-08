(function ($, Drupal) {
    
	Drupal.behaviors.careerChart = {
		attach: function attach(context) {
			// стандартный набор элементов
			let chartBase = '<div class="chart__container"><div class="chart__rows"></div><div class="chart__cols"></div></div>';
			let chartRowBase = '<div class="chart__row"><span class="chart__row__value"></span></div>';
			let chartRowBaseNull = '<div class="chart__row chart__row--null"></div>';
			let chartColBase = '<div class="chart__col"><span class="chart__col__line"></span><span class="chart__col__value"></span><span class="dot"></span><p class="term"></p></div>';
			let chartSvgBase = '<svg class="chart__path" width="100%" height="100%"><path class="chart__area" width="100%"></path><path class="chart__line"></path></svg>';

			// Есть стандартные настройки. Можно задать свои. (Объект)
			var defaultSettings = {
				top: 68.75, // верхняя точка
				bottom: 67.75, // нижняя точка
				rowNumber: 5, // количество строк или false
			};

			// Вспомогательная функция для облегчения работы со стандартными параметрами
			function defaultFor(arg, val) {
				return typeof arg !== 'undefined' ? arg : val;
			}

			// Вспомогательная функция для округления до сотых
			function round(val) {
				return Math.round((val) * 100) / 100;
			}

			// Главная функция. Передается сам график, его настройки, данные
			function initChart(chart, settings, data) {
				let settingsDef = defaultFor(settings, defaultSettings);

				let chartSettings = {
					top: defaultFor(settingsDef.top, defaultSettings.top),
					bottom: defaultFor(settingsDef.bottom, defaultSettings.bottom),
					rowNumber: settingsDef.rowNumber ? defaultFor(settingsDef.rowNumber, defaultSettings.rowNumber) : false,
				};

				let chartData = data;

				for (let dataIndex = 0; dataIndex < chartData.length; dataIndex++) {
					chartData[dataIndex].data = round(chartData[dataIndex].data);
				}

				let rowDiff = chartSettings.top - chartSettings.bottom;
				let rowStep = rowDiff / (chartSettings.rowNumber - 1);
				let dataLength = chartData.length;

				chart.append(chartBase);
				chart.find('.chart__cols').append(chartSvgBase);


				if (chartSettings.rowNumber) {
					for (let i = 1; i <= chartSettings.rowNumber; i++) {
						chart.find('.chart__rows').append(chartRowBase);
						chart.find('.chart__row:last-child').find('.chart__row__value').text(round((chartSettings.rowNumber - i) * rowStep + chartSettings.bottom));
					}
					chart.find('.chart__rows').append(chartRowBaseNull);
				} else {
					chart.find('.chart__rows').append(chartRowBaseNull);
				}

				const lineSVG = chart.find('.chart__path');
				let chartHeight = chart.find('.chart__container').height();
				let chartWidth = $('.chart__container:visible').width();
				let colStep = chartWidth / dataLength;
				
				function drawChartElements () {
					chart.find('.chart__cols .chart__col').remove();

					for (let i = 0; i < dataLength; i++) {
						const $col = $(chartColBase);
						chart.find('.chart__cols').append($col);
	
						$col.find('.chart__col__value').text(chartData[i].term);
						$col.find('.term').text(chartData[i].label);
	
						if (chartData[i].data <= chartSettings.top && chartData[i].data >= chartSettings.bottom) {
							$col.find('.dot').css({
								top: `${(100 * (chartSettings.top - chartData[i].data) / rowDiff) - ($(window).width() > 540 ? chartData[i].offset : chartData[i].offset * 2)}%`,
							});
							$col.find('.chart__col__value').css({
								top: `${(100 * (chartSettings.top - chartData[i].data) / rowDiff) - ($(window).width() > 540 ? chartData[i].offset : chartData[i].offset * 2)}%`,
							});
							$col.find('.chart__col__line').css({
								height: `${(100 - (100 * (chartSettings.top - chartData[i].data) / rowDiff)) + ($(window).width() > 540 ? chartData[i].offset : chartData[i].offset * 2)}%`,
							});
						} else {
							$col.css('visibility', 'hidden');
						}
	
						if (i == dataLength - 1) {
							$col.find('.chart__col__value').addClass('chart__col__value--bubble');
						}
					}
				}
				
				function drawChartLine () {
					lineSVG.css('left', colStep / 2);

					let path = `M0 ${((100 * (chartSettings.top - chartData[0].data) / rowDiff) * chartHeight / 100)}`;
					let area = `M0 ${((100 * (chartSettings.top - chartData[0].data) / rowDiff) * chartHeight / 100)}`;

					for (i = 1; i < dataLength; i++) {
						path += ` L${(colStep * i)} ${((100 * (chartSettings.top - chartData[i].data) / rowDiff) * chartHeight / 100)}`;
						area += ` L${(colStep * i)} ${((100 * (chartSettings.top - chartData[i].data) / rowDiff) * chartHeight / 100)}`;
					}

					lineSVG.find('.chart__line').attr('d', roundPathCorners(path, 25, false));
					lineSVG.find('.chart__area').attr('d', roundPathCorners(area, 25, false));
				}

				drawChartElements();
				drawChartLine();

				$(window).on('resize', function() {
					chartHeight = chart.find('.chart__container').height();
					chartWidth = $('.chart__container:visible').width();
					colStep = chartWidth / dataLength;

					drawChartElements();
					drawChartLine();
				});
			}

			// ВАЖНО! ТЕСТОВЫЙ ЗАПУСК ДЛЯ ДЕМОНСТРАЦИИ
			$('.js-chart', context).once('chart').each(function(i, e) {
				// Запуск с данными по дизайну
				let settings = {
					top: 100,
					bottom: 0,
					rowNumber: false,
				};

				initChart($(e), settings, dataChart);
			});

			// круговой график
			$('.js-pie-chart-circle', context).once('pieChart').each(function(index, element) {
				let $this = $(element);
				let total = $this.data('total');
				let values = [];
				let width = $this.width();
				const borderRadius = window.innerWidth > 540 ? 60 : 40;

				$this.find('.pie-chart__hold').each(function(i, e) {
					values.push(Number(($(e).data('value') / (total / 100)).toFixed(1)));
				});

				$this.find('canvas').each(function(i, e) {
					let $canvas = $(e);
					let canvas = $canvas.get(0);
					let ctx = canvas.getContext('2d');
					let radius = width / 2;
					let start = -Math.PI / 2;
					let color = $canvas.parent().data('color');

					canvas.width = $canvas.parent().width();
					canvas.height = $canvas.parent().height();

					if (i !== 0) {
						start = values.slice(0, i).reduce(function(sum, el) {
							return sum + el;
						}, 0);

						start = Number(start.toFixed(1)) / (100 / (2 * Math.PI)) - Math.PI / 2;
					}

					let end = start + values[i] / (100 / (2 * Math.PI));

					ctx.lineWidth = borderRadius;
					ctx.strokeStyle = color;

					ctx.arc(radius, radius, radius - borderRadius / 2, start, end, false);
					ctx.stroke();
				});
			});

			$('.js-career-profile-form', context).once('career')
				.each(function () {
					const $form = $(this);
					Drupal.behaviors.formValidation.init($form);
				});
		}
	};

})(jQuery, Drupal);