document.addEventListener('DOMContentLoaded', function () {
    var charts = document.querySelectorAll('[data-bss-chart]');

    charts.forEach(function (chart) {
        var ctx = chart.getContext('2d');
        var chartConfig = JSON.parse(chart.getAttribute('data-bss-chart'));

        if (chartConfig) {
            console.log('Creating chart with config:', chartConfig);
            new Chart(ctx, chartConfig);
        }
    });
});