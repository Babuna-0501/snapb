(function(){function CustomEvent(event,params){params=params||{bubbles:false,cancelable:false,detail:undefined};var evt=document.createEvent('CustomEvent');evt.initCustomEvent(event,params.bubbles,params.cancelable,params.detail);return evt;}
CustomEvent.prototype=window.Event.prototype;window.CustomEvent=CustomEvent;})();(function(drupalSettings){'use strict';var iconSelectEvent=new CustomEvent('iconselectloaded');var xhr=new XMLHttpRequest();if(!drupalSettings.icon_select||!drupalSettings.icon_select.icon_select_url){return;}
xhr.open('get',drupalSettings.icon_select.icon_select_url,true);xhr.responseType='document';xhr.onreadystatechange=function(){if(xhr.readyState!==4){return;}
try{var svg=xhr.responseXML.documentElement;svg=document.importNode(svg,true);svg.id='svg-icon-sprite';document.body.appendChild(svg);svg.style.display='none';svg.style.display='block';}
catch(e){console.log(e);}
window.dispatchEvent(iconSelectEvent);};xhr.send();})(drupalSettings);;
(function($,Drupal){'use strict';jQuery.fn.putCursorAtEnd=function(){return this.each(function(){var $el=$(this),el=this;if(!$el.is(":focus")){$el.focus();}
if(el.setSelectionRange){var len=$el.val().length*2;setTimeout(function(){el.setSelectionRange(len,len);},1);}else{$el.val($el.val());}});};if($('.js-search-tab').length>0){$('.icon--search').closest('a').click();var searchField=$('#search form').find('input[type=\'text\']');searchField.putCursorAtEnd();}
var results=[];var searchString='';var submited=false;function showResults(result,settings){if(submited){return;}
var data='<div class="sticky-header__container">';if(result!==null&&result.length>0){$.each(result,function(index,value){data+='<div class="main-search-result__cell">';if(typeof value.href!='undefined'){data+='<a href='+value.href+' class="main-search-result__hd">'+value.name+' <span>'+value.total+'</span></a>';}
else{data+='<a class="main-search-result__hd">'+value.name+' <span>'+value.total+'</span></a>';}
if(value.total===0){data+='<div class="search-res-list__item">';data+=value.empty_text;}
else{data+='<div class="main-search-result__list">';}
if(value.data.length>0){if(value.display_type==='products'){data+='<div class="products-list">';$.each(value.data,function(link_index,link_value){data+=link_value.link;});data+='</div>';}
else if(value.display_type==='products_categories'){data+='<ul class="search-res-list _bold">';$.each(value.data,function(link_index,link_value){data+='<li class="search-res-list__item">';data+=link_value.link;data+='</li>';});data+='</ul>';}
else{data+='<ul class="search-res-list">';$.each(value.data,function(link_index,link_value){data+='<li class="search-res-list__item">';data+=link_value.link;data+='</li>';});data+='</ul>';}}
data+='</div>';if(typeof value.url!=='undefined'){data+=value.url;}
data+='</div>';});}else{data+='<div class="search-result__empty" style="display: block;"><p class="pink text-center">'+settings.bite_search.no_results_text+'</strong></p></div>';window.dataLayer=window.dataLayer||[];window.dataLayer.push({'event':'EmptySearch','keyword':searchString,});}
data+='</div>';$('.js-header-search-results').html(data);}
var loader=function(){var search_container=$('.sticky-header__container');if(search_container.find('.ajax-progress').length===0){var loader='<div class="ajax-progress loader is-active"> <div class="loader__content"> <div class="loader__child loader__child--1"></div><div class="loader__child loader__child--2"></div><div class="loader__child loader__child--3"></div></div></div>';search_container.append(loader);}}
Drupal.behaviors.biteSearch={attach:function(context,settings){$('.js-search-tab',context).click(function(){var href=$(this).data('href');if(typeof href!=='undefined'&&href!==''){loader();window.location.href=href;return false;}});$('.main-search__inp',context).on('paste keyup',function(){var val=$(this).val();val=$.trim(val);if(searchString===val){return;}
searchString=val;if(val.length>=settings.bite_search.min_length){if(typeof results[val]!=='undefined'){if(results[val]!==false){showResults(results[val],settings);}
return;}
results[val]=false;$.ajax({url:settings.bite_search.url,method:'GET',data:{'search':val},dataType:"json",success:function(response){if(typeof response.result!=='undefined'){results[val]=response.result;if(searchString===val){showResults(response.result,settings);}}}});}});}};})(jQuery,Drupal);;
